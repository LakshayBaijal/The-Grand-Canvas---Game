import { MAX_PLAYERS, type Member } from "./rooms.js";

/**
 * The ranked queue.
 *
 * One global queue rather than "join any open public lobby": matchmaking has
 * to be able to hold players back until there are enough of them, which a
 * join-the-first-open-room approach can't do.
 *
 * Backfill exists so nobody ever stares at a spinner forever. Fifty seconds:
 * long enough for a second person who pressed play at about the same time to
 * land, short enough that nobody gives up waiting. Players are never told the
 * difference: the queue screen shows a plain countdown, and a filled seat
 * looks like any other player.
 */
export const BOT_FILL_SECONDS = 50;

/** Games start the moment this many humans are queued, without waiting. */
export const MATCH_SIZE = MAX_PLAYERS;

type Waiting = Member & { joinedMs: number };

const queue: Waiting[] = [];
let ticker: NodeJS.Timeout | null = null;

export function enqueue(member: Member): void {
  if (isQueued(member.playerId)) return;
  queue.push({ ...member, joinedMs: Date.now() });
}

export function dequeue(playerId: string): boolean {
  const i = queue.findIndex((w) => w.playerId === playerId);
  if (i === -1) return false;
  queue.splice(i, 1);
  return true;
}

export function isQueued(playerId: string): boolean {
  return queue.some((w) => w.playerId === playerId);
}

export function queued(): readonly Waiting[] {
  return queue;
}

/** When the oldest waiting player's patience runs out and bots step in. */
export function botFillAtMs(): number {
  if (queue.length === 0) return 0;
  return queue[0].joinedMs + BOT_FILL_SECONDS * 1000;
}

/**
 * Starts the queue running. [onMatch] receives the matched humans plus how
 * many bots are needed to round the lobby out.
 */
export function startMatchmaker(handlers: {
  onMatch: (members: Member[], botsNeeded: number) => void;
  onTick: () => void;
}): void {
  if (ticker) return;
  ticker = setInterval(() => {
    // A full house always goes immediately.
    while (queue.length >= MATCH_SIZE) {
      handlers.onMatch(queue.splice(0, MATCH_SIZE), 0);
    }
    // Otherwise the longest wait decides when to start with bots.
    if (queue.length > 0 && Date.now() >= botFillAtMs()) {
      const members = queue.splice(0, queue.length);
      handlers.onMatch(members, MATCH_SIZE - members.length);
    }
    handlers.onTick();
  }, 1000);
}

export function stopMatchmaker(): void {
  if (ticker) clearInterval(ticker);
  ticker = null;
}
