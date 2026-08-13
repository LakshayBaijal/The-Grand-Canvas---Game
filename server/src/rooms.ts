import type { WebSocket } from "ws";
import type {
  DrawingEntry,
  InvestmentResult,
  InvestorShare,
  PlayerInfo,
  ScoreRow,
  Stroke,
} from "./types.js";
import { fillTemplate, pickTemplate } from "./prompts.js";
import { createBot } from "./bots.js";

export const MAX_PLAYERS = 5;
export const MIN_PLAYERS_TO_START = 1;

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

export type Phase = "lobby" | "prompt_writing" | "drawing" | "investing" | "reveal" | "results";

export type Lobby = {
  code: string;
  hostId: string;
  players: Map<string, Player>;
  phase: Phase;
  isPublic: boolean;

  // --- round rotation: one round per player, taking turns writing the blank ---
  writerOrder: string[];
  roundIndex: number;
  usedTemplateIndices: Set<number>;
  currentTemplate: string;
  completedPrompt: string;

  // --- this round's submissions ---
  roundDrawings: Map<string, { title: string; strokes: Stroke[] }>;
  investments: Map<string, Map<string, number>>; // investorId -> (artistId -> amount)

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

function newLobby(hostId: string, hostWs: WebSocket, nickname: string, isPublic: boolean): Lobby {
  const code = generateCode();
  const lobby: Lobby = {
    code,
    hostId,
    players: new Map([[hostId, { id: hostId, nickname, ws: hostWs, isBot: false }]]),
    phase: "lobby",
    isPublic,
    writerOrder: [],
    roundIndex: 0,
    usedTemplateIndices: new Set(),
    currentTemplate: "",
    completedPrompt: "",
    roundDrawings: new Map(),
    investments: new Map(),
    scores: new Map([[hostId, 0]]),
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

export function createLobby(hostId: string, hostWs: WebSocket, nickname: string): Lobby {
  return newLobby(hostId, hostWs, nickname, false);
}

/** Joins a random public lobby that's still waiting in the lobby phase and has
 *  room. If there isn't one, opens a new public lobby instead. */
export function quickPlay(playerId: string, ws: WebSocket, nickname: string): Lobby {
  const open = Array.from(lobbies.values()).filter(
    (l) => l.isPublic && l.phase === "lobby" && l.players.size < MAX_PLAYERS,
  );
  if (open.length === 0) return newLobby(playerId, ws, nickname, true);

  open.sort((a, b) => b.players.size - a.players.size);
  const lobby = open[0];
  lobby.players.set(playerId, { id: playerId, nickname, ws, isBot: false });
  lobby.scores.set(playerId, 0);
  return lobby;
}

export function joinLobby(
  rawCode: string,
  playerId: string,
  ws: WebSocket,
  nickname: string,
): Lobby {
  const lobby = lobbies.get(rawCode.trim().toUpperCase());
  if (!lobby) throw new Error("No lobby with that code");
  if (lobby.phase !== "lobby") throw new Error("That game already started");
  if (lobby.players.size >= MAX_PLAYERS) throw new Error("That lobby is full");
  lobby.players.set(playerId, { id: playerId, nickname, ws, isBot: false });
  lobby.scores.set(playerId, 0);
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
  lobby.phase = "prompt_writing";
  lobby.roundDrawings = new Map();
  lobby.investments = new Map();
}

export function recordPrompt(lobby: Lobby, text: string): void {
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
): void {
  const cleanTitle = title.trim().slice(0, 40) || "Untitled";
  lobby.roundDrawings.set(playerId, { title: cleanTitle, strokes });
}

export function everyoneDrew(lobby: Lobby): boolean {
  return Array.from(lobby.players.keys()).every((id) => lobby.roundDrawings.has(id));
}

export function drawingEntries(lobby: Lobby): DrawingEntry[] {
  return Array.from(lobby.players.entries())
    .filter(([id]) => lobby.roundDrawings.has(id))
    .map(([id, p]) => {
      const d = lobby.roundDrawings.get(id)!;
      return { artistId: id, artistName: p.nickname, title: d.title, strokes: d.strokes };
    });
}

// --- investing --------------------------------------------------------------

export function beginInvesting(lobby: Lobby): void {
  lobby.phase = "investing";
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

export function everyoneInvested(lobby: Lobby): boolean {
  return Array.from(lobby.players.keys()).every((id) => lobby.investments.has(id));
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

/** Tallies investments into each drawing's total, pays placement bonuses to
 *  the top 3 earners, penalizes anyone who left budget unspent (deducted
 *  from their own round earnings — spend it or lose it), and returns the
 *  reveal payload sorted by total investment, highest first. */
export function scoreRoundAndBuildReveal(lobby: Lobby): InvestmentResult[] {
  lobby.roundDeltas = new Map();
  lobby.roundRaised = new Map();
  lobby.roundBonus = new Map();
  lobby.roundPenalty = new Map();
  lobby.phase = "reveal";

  const totals = new Map<string, number>();
  const investorsByArtist = new Map<string, InvestorShare[]>();

  for (const [investorId, allocations] of lobby.investments) {
    const investorName = lobby.players.get(investorId)?.nickname ?? "(left)";
    for (const [artistId, amount] of allocations) {
      totals.set(artistId, (totals.get(artistId) ?? 0) + amount);
      const list = investorsByArtist.get(artistId) ?? [];
      list.push({ name: investorName, amount });
      investorsByArtist.set(artistId, list);
    }
  }

  const entries: InvestmentResult[] = drawingEntries(lobby).map((entry) => ({
    ...entry,
    totalInvested: totals.get(entry.artistId) ?? 0,
    investors: (investorsByArtist.get(entry.artistId) ?? []).sort((a, b) => b.amount - a.amount),
  }));
  entries.sort((a, b) => b.totalInvested - a.totalInvested);

  // Placement bonuses, by rank.
  entries.forEach((entry, rank) => {
    lobby.roundRaised.set(entry.artistId, entry.totalInvested);
    const bonus = PLACEMENT_BONUSES[rank] ?? 0;
    if (bonus > 0) lobby.roundBonus.set(entry.artistId, bonus);
    addScore(lobby, entry.artistId, entry.totalInvested + bonus);
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
  lobby.roundDrawings = new Map();
  lobby.investments = new Map();
  lobby.roundDeltas = new Map();
  lobby.roundRaised = new Map();
  lobby.roundBonus = new Map();
  lobby.roundPenalty = new Map();
  lobby.scores = new Map(Array.from(lobby.players.keys()).map((id) => [id, 0]));
}
