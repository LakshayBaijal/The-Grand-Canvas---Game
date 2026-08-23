import type { WebSocket } from "ws";
import type {
  Backer,
  DrawingEntry,
  GameMode,
  LobbyVisibility,
  OpenLobby,
  PlayerInfo,
  RoundResult,
  ScoreRow,
  Stroke,
} from "./types.js";
import { fillTemplate, pickTemplate } from "./prompts.js";
import { createBot } from "./bots.js";
import {
  BOT_RATING,
  rateGame,
  START_RATING,
  type Contender,
  type RatingChange,
} from "./ranking.js";

export const MAX_PLAYERS = 5;
export const MIN_PLAYERS_TO_START = 1;

/** Places a friendly-game voter picks, best first, and what each is worth. */
export const RANKING_POINTS = [3, 2, 1];

/** Trophies for finishing 1st..5th in a ranked game (index 0 = 1st). Trophies
 *  only ever accumulate — see store.recordRankedResult. */
export const TROPHIES_BY_PLACE = [30, 18, 10, 5, 2];

/** Beat between a ranked lobby forming and its first prompt, so players can
 *  see the table they were dealt. */
export const RANKED_START_DELAY_SECONDS = 3;

export const PROMPT_SECONDS = 40;
export const DRAW_SECONDS = 75;
export const INVEST_SECONDS = 35;
export const REVEAL_SECONDS = 14;

/** Every round each player gets $2000, minus a $200 "entry fee" that funds
 *  the placement bonuses below — see PLACEMENT_BONUSES. */
export const INVESTMENT_BUDGET = 1800;

/** Increment the +/- buttons move by. Must divide INVESTMENT_BUDGET exactly,
 *  or players physically cannot spend their whole budget and would always
 *  eat the unspent-money penalty. */
export const INVESTMENT_STEP = 200;

/** Bonus paid to the artist ranked 1st/2nd/3rd by money raised this round
 *  (index 0 = 1st place), regardless of how many players are in the game. */
export const PLACEMENT_BONUSES = [500, 300, 100];

/** How long the client spends showing each drawing one at a time before the
 *  interactive investing screen appears — kept here so index.ts can extend
 *  the phase timer to match. Must equal the per-entry duration used in
 *  app/lib/views/investing_view.dart's presentation sequence. */
export const PRESENT_SECONDS_PER_ENTRY = 3.5;

/** Bots are ordinary lobby members with no socket — every phase check
 *  (`everyoneDrew`, scoring, rotation) treats them exactly like humans, so
 *  there is no separate bot code path through the game. */
type Player = PlayerInfo & { ws: WebSocket | null; isBot: boolean };

export type Phase = "lobby" | "prompt_writing" | "drawing" | "voting" | "reveal" | "results";

export type Lobby = {
  code: string;
  hostId: string;
  players: Map<string, Player>;
  phase: Phase;
  mode: GameMode;
  /** Whether this shows up in the browser. Ranked lobbies are always private:
   *  they are built complete by matchmaking and must never be joinable. */
  visibility: LobbyVisibility;
  createdAtMs: number;

  // --- round rotation: one round per player, taking turns writing the blank ---
  writerOrder: string[];
  roundIndex: number;
  usedTemplateIndices: Set<number>;
  currentTemplate: string;
  completedPrompt: string;
  /** Just the words the writer typed into the blank. Kept apart from the
   *  finished sentence because it's the only part anyone chose, which makes it
   *  the best signal for what a drawing should depict. */
  promptAnswer: string;

  // --- this round's submissions ---
  roundDrawings: Map<string, { title: string; strokes: Stroke[]; paper?: string }>;
  /** Ranked: investorId -> (artistId -> amount). */
  investments: Map<string, Map<string, number>>;
  /** Friendly: voterId -> ordered artistIds, best first. */
  rankings: Map<string, string[]>;

  scores: Map<string, number>;
  roundDeltas: Map<string, number>;
  // Breakdown of this round's delta, for the reveal screen to explain it:
  roundRaised: Map<string, number>; // money received as artist (excludes placement bonus)
  roundBonus: Map<string, number>; // placement bonus (500/300/100/0)
  roundPenalty: Map<string, number>; // amount deducted for leaving budget unspent

  deadlineMs: number;
  timer: NodeJS.Timeout | null;
  /** Pending bot actions for the current phase; cleared on every transition
   *  so a stale bot can't submit into the next phase. */
  botTimers: NodeJS.Timeout[];
};

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

const lobbies = new Map<string, Lobby>();

function generateCode(): string {
  let code: string;
  do {
    code = Array.from(
      { length: 4 },
      () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
    ).join("");
  } while (lobbies.has(code));
  return code;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export type Member = { playerId: string; ws: WebSocket; nickname: string };

function emptyLobby(hostId: string, mode: GameMode, visibility: LobbyVisibility): Lobby {
  const code = generateCode();
  const lobby: Lobby = {
    code,
    hostId,
    players: new Map(),
    phase: "lobby",
    mode,
    visibility,
    createdAtMs: Date.now(),
    writerOrder: [],
    roundIndex: 0,
    usedTemplateIndices: new Set(),
    currentTemplate: "",
    completedPrompt: "",
    promptAnswer: "",
    roundDrawings: new Map(),
    investments: new Map(),
    rankings: new Map(),
    scores: new Map(),
    roundDeltas: new Map(),
    roundRaised: new Map(),
    roundBonus: new Map(),
    roundPenalty: new Map(),
    deadlineMs: 0,
    timer: null,
    botTimers: [],
  };
  lobbies.set(code, lobby);
  return lobby;
}

function seat(lobby: Lobby, member: Member): void {
  lobby.players.set(member.playerId, {
    id: member.playerId,
    nickname: member.nickname,
    ws: member.ws,
    isBot: false,
  });
  lobby.scores.set(member.playerId, 0);
}

/** A friendly game. Scores nothing on the leaderboard.
 *
 *  Listed in the browser unless the host asks otherwise; the code works
 *  regardless, so making it private only hides it, it never locks anyone out
 *  who was given the code. */
export function createFriendlyLobby(host: Member, visibility: LobbyVisibility = "public"): Lobby {
  const lobby = emptyLobby(host.playerId, "friendly", visibility);
  seat(lobby, host);
  return lobby;
}

/** Host-only. Returns false if the lobby has already started, since listing a
 *  game in progress would only offer joins that are then refused. */
export function setVisibility(lobby: Lobby, visibility: LobbyVisibility): boolean {
  if (lobby.mode !== "friendly" || lobby.phase !== "lobby") return false;
  lobby.visibility = visibility;
  return true;
}

/** Everything the browser should show: friendly, public, still in the lobby
 *  phase, and with a seat free. Freshest first — a lobby that has been sitting
 *  open for ten minutes is usually someone who wandered off. */
export function openLobbies(): OpenLobby[] {
  const open: OpenLobby[] = [];
  for (const lobby of lobbies.values()) {
    if (lobby.mode !== "friendly") continue;
    if (lobby.visibility !== "public") continue;
    if (lobby.phase !== "lobby") continue;
    if (lobby.players.size >= MAX_PLAYERS) continue;
    const host = lobby.players.get(lobby.hostId);
    let bots = 0;
    for (const p of lobby.players.values()) if (p.isBot) bots++;
    open.push({
      code: lobby.code,
      hostName: host?.nickname ?? "Someone",
      players: lobby.players.size,
      maxPlayers: MAX_PLAYERS,
      bots,
      createdAtMs: lobby.createdAtMs,
    });
  }
  return open.sort((a, b) => b.createdAtMs - a.createdAtMs);
}

/** A matchmade game, built in one shot from everyone the queue matched
 *  together — ranked lobbies are never joinable after the fact, so a game in
 *  progress can't be gate-crashed. */
export function createRankedLobby(members: Member[]): Lobby {
  const lobby = emptyLobby(members[0].playerId, "ranked", "private");
  for (const member of members) seat(lobby, member);
  return lobby;
}

export function joinLobby(rawCode: string, member: Member): Lobby {
  const lobby = lobbies.get(rawCode.trim().toUpperCase());
  if (!lobby) throw new Error("No lobby with that code");
  if (lobby.mode !== "friendly") throw new Error("That code isn't joinable");
  // Note: no visibility check. "Private" hides a lobby from the browser; it
  // does not revoke codes already shared with friends.
  if (lobby.phase !== "lobby") throw new Error("That game already started");
  if (lobby.players.size >= MAX_PLAYERS) throw new Error("That lobby is full");
  seat(lobby, member);
  return lobby;
}

export function getLobbyByPlayer(playerId: string): Lobby | undefined {
  for (const lobby of lobbies.values()) {
    if (lobby.players.has(playerId)) return lobby;
  }
  return undefined;
}

/** Adds a bot to the lobby. Returns null when there's no room for one. */
export function addBot(lobby: Lobby): Player | null {
  if (lobby.phase !== "lobby") return null;
  if (lobby.players.size >= MAX_PLAYERS) return null;
  const taken = new Set(Array.from(lobby.players.values(), (p) => p.nickname));
  const { id, nickname } = createBot(taken);
  const bot: Player = { id, nickname, ws: null, isBot: true };
  lobby.players.set(id, bot);
  lobby.scores.set(id, 0);
  return bot;
}

/** Removes the most recently added bot. Returns false when there were none. */
export function removeBot(lobby: Lobby): boolean {
  if (lobby.phase !== "lobby") return false;
  const botIds = Array.from(lobby.players.values())
    .filter((p) => p.isBot)
    .map((p) => p.id);
  if (botIds.length === 0) return false;
  const last = botIds[botIds.length - 1];
  lobby.players.delete(last);
  lobby.scores.delete(last);
  return true;
}

export function botIds(lobby: Lobby): string[] {
  return Array.from(lobby.players.values())
    .filter((p) => p.isBot)
    .map((p) => p.id);
}

export function isBot(lobby: Lobby, playerId: string): boolean {
  return lobby.players.get(playerId)?.isBot ?? false;
}

function humanCount(lobby: Lobby): number {
  return Array.from(lobby.players.values()).filter((p) => !p.isBot).length;
}

export function leaveLobby(playerId: string): Lobby | undefined {
  const lobby = getLobbyByPlayer(playerId);
  if (!lobby) return undefined;

  lobby.players.delete(playerId);
  lobby.roundDrawings.delete(playerId);
  lobby.investments.delete(playerId);
  lobby.rankings.delete(playerId);

  // Bots can't keep a room alive on their own — once the last human leaves,
  // tear the lobby down instead of leaving bots playing to an empty house.
  if (humanCount(lobby) === 0) {
    clearLobbyTimer(lobby);
    clearBotTimers(lobby);
    lobbies.delete(lobby.code);
    return undefined;
  }

  if (lobby.hostId === playerId) {
    // Hosting must land on a human, otherwise nobody could start or restart.
    const nextHuman = Array.from(lobby.players.values()).find((p) => !p.isBot);
    if (nextHuman) lobby.hostId = nextHuman.id;
  }
  return lobby;
}

export function playerInfos(lobby: Lobby): PlayerInfo[] {
  return Array.from(lobby.players.values()).map(({ id, nickname, isBot }) => ({
    id,
    nickname,
    isBot,
  }));
}

/** Only real players have sockets; bots are skipped when broadcasting. */
export function lobbySockets(lobby: Lobby): WebSocket[] {
  return Array.from(lobby.players.values())
    .map((p) => p.ws)
    .filter((ws): ws is WebSocket => ws !== null);
}

export function clearLobbyTimer(lobby: Lobby): void {
  if (lobby.timer) {
    clearTimeout(lobby.timer);
    lobby.timer = null;
  }
}

export function clearBotTimers(lobby: Lobby): void {
  for (const timer of lobby.botTimers) clearTimeout(timer);
  lobby.botTimers = [];
}

export function scheduleBotAction(lobby: Lobby, delayMs: number, fn: () => void): void {
  lobby.botTimers.push(setTimeout(fn, delayMs));
}

/** Schedules [fn] to run when the current phase's clock runs out. Replaces any
 *  previously scheduled phase timer. */
export function setPhaseTimer(lobby: Lobby, seconds: number, fn: () => void): number {
  clearLobbyTimer(lobby);
  lobby.deadlineMs = Date.now() + seconds * 1000;
  // Small grace period so a client submitting right at the buzzer still counts.
  lobby.timer = setTimeout(fn, seconds * 1000 + 1500);
  return lobby.deadlineMs;
}

// --- round rotation -----------------------------------------------------

/** One round per human player: each gets exactly one turn writing the blank.
 *  Bots are deliberately excluded — filling in the blank is the creative half
 *  of the game, so it stays with real players (bots still draw and invest). */
export function startWriterRotation(lobby: Lobby): void {
  const humans = Array.from(lobby.players.values())
    .filter((p) => !p.isBot)
    .map((p) => p.id);
  lobby.writerOrder = shuffle(humans);
  lobby.roundIndex = 0;
  lobby.usedTemplateIndices = new Set();
}

export function currentWriterId(lobby: Lobby): string | undefined {
  return lobby.writerOrder[lobby.roundIndex];
}

export function totalRounds(lobby: Lobby): number {
  return lobby.writerOrder.length;
}

export function beginPromptWriting(lobby: Lobby): void {
  const { index, template } = pickTemplate(lobby.usedTemplateIndices);
  lobby.usedTemplateIndices.add(index);
  lobby.currentTemplate = template;
  lobby.completedPrompt = "";
  lobby.promptAnswer = "";
  lobby.phase = "prompt_writing";
  lobby.roundDrawings = new Map();
  lobby.investments = new Map();
  lobby.rankings = new Map();
}

export function recordPrompt(lobby: Lobby, text: string): void {
  lobby.promptAnswer = text.trim().slice(0, 60);
  lobby.completedPrompt = fillTemplate(lobby.currentTemplate, text);
}

// --- drawing --------------------------------------------------------------

export function beginDrawingRound(lobby: Lobby): void {
  lobby.phase = "drawing";
}

export function recordDrawing(
  lobby: Lobby,
  playerId: string,
  title: string,
  strokes: Stroke[],
  paper?: string,
): void {
  const cleanTitle = title.trim().slice(0, 40) || "Untitled";
  // Cosmetics are passed through, not validated — a nonsense value just falls
  // back to the default sheet on the client.
  lobby.roundDrawings.set(playerId, { title: cleanTitle, strokes, paper });
}

export function everyoneDrew(lobby: Lobby): boolean {
  return Array.from(lobby.players.keys()).every((id) => lobby.roundDrawings.has(id));
}

export function drawingEntries(lobby: Lobby): DrawingEntry[] {
  return Array.from(lobby.players.entries())
    .filter(([id]) => lobby.roundDrawings.has(id))
    .map(([id, p]) => {
      const d = lobby.roundDrawings.get(id)!;
      return {
        artistId: id,
        artistName: p.nickname,
        title: d.title,
        strokes: d.strokes,
        paper: d.paper,
      };
    });
}

// --- voting -----------------------------------------------------------------

export function beginVoting(lobby: Lobby): void {
  lobby.phase = "voting";
}

/** Ranked games invest money; friendly games just pick a podium. */
export function scoringFor(lobby: Lobby): "money" | "points" {
  return lobby.mode === "ranked" ? "money" : "points";
}

export function everyoneVoted(lobby: Lobby): boolean {
  const submitted = scoringFor(lobby) === "money" ? lobby.investments : lobby.rankings;
  return Array.from(lobby.players.keys()).every((id) => submitted.has(id));
}

export function voteCount(lobby: Lobby): number {
  return scoringFor(lobby) === "money" ? lobby.investments.size : lobby.rankings.size;
}

/** Cleans and clamps a player's allocations: no self-investment, no
 *  investing in someone who didn't submit a drawing, no going over budget
 *  (anything past the budget in iteration order is dropped). */
export function recordInvestment(
  lobby: Lobby,
  investorId: string,
  allocations: Record<string, number>,
): void {
  const clean = new Map<string, number>();
  let total = 0;
  for (const [artistId, amountRaw] of Object.entries(allocations)) {
    if (artistId === investorId) continue;
    if (!lobby.roundDrawings.has(artistId)) continue;
    const amount = Math.max(0, Math.floor(amountRaw));
    if (amount === 0) continue;
    if (total + amount > INVESTMENT_BUDGET) continue;
    total += amount;
    clean.set(artistId, amount);
  }
  lobby.investments.set(investorId, clean);
}

/** Cleans a friendly-game podium: no voting for yourself, no duplicates, no
 *  entries that didn't submit, and no more places than RANKING_POINTS pays. */
export function recordRanking(lobby: Lobby, voterId: string, order: string[]): void {
  const clean: string[] = [];
  for (const artistId of order) {
    if (artistId === voterId) continue;
    if (!lobby.roundDrawings.has(artistId)) continue;
    if (clean.includes(artistId)) continue;
    clean.push(artistId);
    if (clean.length === RANKING_POINTS.length) break;
  }
  lobby.rankings.set(voterId, clean);
}

function addScore(lobby: Lobby, playerId: string, points: number): void {
  lobby.scores.set(playerId, (lobby.scores.get(playerId) ?? 0) + points);
  lobby.roundDeltas.set(playerId, (lobby.roundDeltas.get(playerId) ?? 0) + points);
}

function amountSpent(lobby: Lobby, investorId: string): number {
  const allocations = lobby.investments.get(investorId);
  if (!allocations) return 0;
  let total = 0;
  for (const amount of allocations.values()) total += amount;
  return total;
}

/** Builds the reveal payload for whichever scoring this lobby uses, applying
 *  the round's score changes as it goes. Sorted best first either way. */
export function scoreRoundAndBuildReveal(lobby: Lobby): RoundResult[] {
  lobby.roundDeltas = new Map();
  lobby.roundRaised = new Map();
  lobby.roundBonus = new Map();
  lobby.roundPenalty = new Map();
  lobby.phase = "reveal";

  return scoringFor(lobby) === "money" ? scoreByInvestment(lobby) : scoreByRanking(lobby);
}

/** Ranked: tallies investments into each drawing's total, pays placement
 *  bonuses to the top 3 earners, and penalizes anyone who left budget unspent
 *  (deducted from their own round earnings — spend it or lose it). */
function scoreByInvestment(lobby: Lobby): RoundResult[] {
  const totals = new Map<string, number>();
  const backersByArtist = new Map<string, Backer[]>();

  for (const [investorId, allocations] of lobby.investments) {
    const investorName = lobby.players.get(investorId)?.nickname ?? "(left)";
    for (const [artistId, amount] of allocations) {
      totals.set(artistId, (totals.get(artistId) ?? 0) + amount);
      const list = backersByArtist.get(artistId) ?? [];
      list.push({ name: investorName, amount });
      backersByArtist.set(artistId, list);
    }
  }

  const entries = buildResults(lobby, totals, backersByArtist);

  // Placement bonuses, by rank.
  entries.forEach((entry, rank) => {
    lobby.roundRaised.set(entry.artistId, entry.total);
    const bonus = PLACEMENT_BONUSES[rank] ?? 0;
    if (bonus > 0) lobby.roundBonus.set(entry.artistId, bonus);
    addScore(lobby, entry.artistId, entry.total + bonus);
  });

  // Spend-it-or-lose-it: unspent budget comes out of your own earnings.
  for (const playerId of lobby.players.keys()) {
    const unspent = INVESTMENT_BUDGET - amountSpent(lobby, playerId);
    if (unspent > 0) {
      lobby.roundPenalty.set(playerId, unspent);
      addScore(lobby, playerId, -unspent);
    }
  }

  return entries;
}

/** Friendly: each voter's podium pays 3/2/1. No bonuses and no penalties —
 *  the whole point of friendly games is that there's nothing to lose. */
function scoreByRanking(lobby: Lobby): RoundResult[] {
  const totals = new Map<string, number>();
  const backersByArtist = new Map<string, Backer[]>();

  for (const [voterId, order] of lobby.rankings) {
    const voterName = lobby.players.get(voterId)?.nickname ?? "(left)";
    order.forEach((artistId, place) => {
      const points = RANKING_POINTS[place] ?? 0;
      if (points === 0) return;
      totals.set(artistId, (totals.get(artistId) ?? 0) + points);
      const list = backersByArtist.get(artistId) ?? [];
      list.push({ name: voterName, amount: points });
      backersByArtist.set(artistId, list);
    });
  }

  const entries = buildResults(lobby, totals, backersByArtist);
  for (const entry of entries) {
    lobby.roundRaised.set(entry.artistId, entry.total);
    addScore(lobby, entry.artistId, entry.total);
  }
  return entries;
}

function buildResults(
  lobby: Lobby,
  totals: Map<string, number>,
  backersByArtist: Map<string, Backer[]>,
): RoundResult[] {
  const entries: RoundResult[] = drawingEntries(lobby).map((entry) => ({
    ...entry,
    total: totals.get(entry.artistId) ?? 0,
    backers: (backersByArtist.get(entry.artistId) ?? []).sort((a, b) => b.amount - a.amount),
  }));
  entries.sort((a, b) => b.total - a.total);
  return entries;
}

/**
 * Trophies each human takes away from a finished ranked game, by final
 * placement.
 *
 * Scaled by how much of the lobby was real people: beating four bots is not
 * the same achievement as beating four humans, and without this any player
 * could farm the leaderboard by queueing alone until the bot backfill fired.
 * Everyone who finishes still gets at least 1, so a game is never wasted time.
 */
export function trophiesForGame(lobby: Lobby): Record<string, number> {
  if (lobby.mode !== "ranked") return {};
  const humans = humanCount(lobby);
  const share = lobby.players.size > 0 ? humans / lobby.players.size : 0;
  const awards: Record<string, number> = {};

  scoreRows(lobby).forEach((row, place) => {
    if (isBot(lobby, row.playerId)) return;
    const base = TROPHIES_BY_PLACE[place] ?? TROPHIES_BY_PLACE[TROPHIES_BY_PLACE.length - 1];
    awards[row.playerId] = Math.max(1, Math.round(base * share));
  });
  return awards;
}

/**
 * Rating changes for a finished ranked game.
 *
 * Unlike trophies, this can go down — it's the number the leaderboard sorts
 * by, so it has to be able to. Bots are included as opponents but count for
 * very little (see BOT_WEIGHT), which is what makes queueing alone against a
 * bot backfill worth almost nothing either way.
 *
 * [ratings] supplies each human's current rating; anyone missing is treated as
 * unrated and starts from the default.
 */
export function ratingsForGame(
  lobby: Lobby,
  ratings: Map<string, { rating: number; gamesPlayed: number }>,
): RatingChange[] {
  if (lobby.mode !== "ranked") return [];

  const rows = scoreRows(lobby);
  // Equal scores must share a place, or a coin-flip tie would move ratings.
  const contenders: Contender[] = rows.map((row, index) => {
    const firstEqual = rows.findIndex((r) => r.score === row.score);
    const known = ratings.get(row.playerId);
    return {
      playerId: row.playerId,
      rating: isBot(lobby, row.playerId) ? BOT_RATING : known?.rating ?? START_RATING,
      isBot: isBot(lobby, row.playerId),
      place: firstEqual >= 0 ? firstEqual : index,
      gamesPlayed: known?.gamesPlayed ?? 0,
    };
  });

  return rateGame(contenders);
}

export function scoreRows(lobby: Lobby): ScoreRow[] {
  return Array.from(lobby.players.values())
    .map((p) => ({
      playerId: p.id,
      nickname: p.nickname,
      score: lobby.scores.get(p.id) ?? 0,
      delta: lobby.roundDeltas.get(p.id) ?? 0,
      raised: lobby.roundRaised.get(p.id) ?? 0,
      bonus: lobby.roundBonus.get(p.id) ?? 0,
      penalty: lobby.roundPenalty.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.score - a.score);
}

/** Advances to the next player's turn writing the blank. Returns false once
 *  everyone has had a turn. */
export function advanceRound(lobby: Lobby): boolean {
  lobby.roundIndex += 1;
  return lobby.roundIndex < lobby.writerOrder.length;
}

/** Returns the lobby to a fresh pre-game state, keeping the players and code. */
export function resetToLobby(lobby: Lobby): void {
  clearLobbyTimer(lobby);
  clearBotTimers(lobby);
  lobby.phase = "lobby";
  lobby.writerOrder = [];
  lobby.roundIndex = 0;
  lobby.usedTemplateIndices = new Set();
  lobby.currentTemplate = "";
  lobby.completedPrompt = "";
  lobby.promptAnswer = "";
  lobby.roundDrawings = new Map();
  lobby.investments = new Map();
  lobby.rankings = new Map();
  lobby.roundDeltas = new Map();
  lobby.roundRaised = new Map();
  lobby.roundBonus = new Map();
  lobby.roundPenalty = new Map();
  lobby.scores = new Map(Array.from(lobby.players.keys()).map((id) => [id, 0]));
}
