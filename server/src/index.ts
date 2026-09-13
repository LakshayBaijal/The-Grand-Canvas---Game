import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { WebSocket, WebSocketServer } from "ws";
import { advertiseOnLocalNetwork } from "./discovery.js";
import { googleEnabled, verifyGoogle } from "./google.js";
import type { ClientMessage, HallDay, LeagueInfo, Profile, ServerMessage } from "./types.js";
import { leagueFor, PLACEMENT_GAMES, seasonEndsAt } from "./ranking.js";
import {
  botDelayMs,
  botDrawing,
  botInvestment,
  botRanking,
  botTitle,
  randomBotName,
} from "./bots.js";
import { pickDemoPrompt } from "./prompts.js";
import { dailyFor, dayOf, promptForDay } from "./daily.js";
import { asInt, cleanText, RateLimit, sanitizeStrokes } from "./validate.js";
import { hasProfanity, maskProfanity } from "./profanity.js";
import * as store from "./store.js";
import * as queue from "./matchmaking.js";
import {
  DRAW_SECONDS,
  INVEST_SECONDS,
  INVESTMENT_BUDGET,
  INVESTMENT_STEP,
  MIN_PLAYERS_TO_START,
  PRESENT_SECONDS_PER_ENTRY,
  PROMPT_SECONDS,
  RANKED_START_DELAY_SECONDS,
  RANKING_POINTS,
  REVEAL_SECONDS,
  SHOWCASE_SECONDS_PER_ENTRY,
  FUNDING_GOAL,
  addBot,
  advanceRound,
  beginDrawingRound,
  beginPromptWriting,
  beginVoting,
  botIds,
  clearBotTimers,
  clearLobbyTimer,
  createFriendlyLobby,
  openLobbies,
  setVisibility,
  createRankedLobby,
  currentWriterId,
  drawingEntries,
  everyoneDrew,
  everyoneVoted,
  getLobbyByPlayer,
  joinLobby,
  leaveLobby,
  lobbySockets,
  playerInfos,
  recordDrawing,
  recordInvestment,
  recordPrompt,
  recordRanking,
  removeBot,
  resetToLobby,
  scheduleBotAction,
  scoreRoundAndBuildReveal,
  scoreRows,
  scoringFor,
  setPhaseTimer,
  startWriterRotation,
  totalRounds,
  ratingsForGame,
  trophiesForGame,
  voteCount,
  type Lobby,
  type Member,
  stalledLobbies,
} from "./rooms.js";

// Settings come from a .env file at the repo root (see .env.example there),
// or from the process environment, which wins when both set the same name.
// Looked for in the server folder first, then one level up, so it works
// both from `server/` (the start scripts) and from a deployed checkout.
for (const candidate of [".env", "../.env"]) {
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
}

const PORT = Number(process.env.PORT ?? 8090);
const DB_PATH = process.env.DB_PATH ?? "data/leaderboard.db";

store.openStore(DB_PATH);

/** Trim the drawing archive on the way up, then daily. Doing it on a timer
 *  rather than after each game keeps the delete off the path a player is
 *  waiting on, and this server is expected to stay up for weeks at a time. */
function prune(): void {
  const { byAge, byCount } = store.pruneDrawings();
  if (byAge + byCount > 0) {
    console.log(`[archive] pruned ${byAge} expired, ${byCount} over cap (${store.countDrawings()} kept)`);
  }
  // Freeze before pruning, or a day could be pruned unfrozen and its top
  // three lost -- the order of these two lines is the whole hall of fame.
  freezeFinishedDays();
  const daily = store.pruneDaily();
  if (daily > 0) console.log(`[daily] pruned ${daily} entries from old galleries`);
}
prune();
setInterval(prune, 24 * 60 * 60 * 1000).unref();

/**
 * The stuck-game watchdog.
 *
 * Every timed phase ends by a timer. If that timer is ever lost — whatever
 * the cause — the players are left on a screen that never changes. Rather
 * than bet on never having that bug, this sweeps for any game sitting well
 * past its deadline, says so loudly, and moves it on using the same finisher
 * the timer would have called. The old timer is cleared first so a late one
 * can't fire on top and advance the game twice.
 */
const STALL_GRACE_MS = 30_000;

/** Longer than any phase could legitimately run. A game this far past its
 *  deadline was not slow — the process was frozen (host asleep, container
 *  paused) and the clock jumped when it woke. Worth saying, because it means
 *  the timers are fine and the machine is the thing to look at. */
const CLOCK_JUMP_MS = 10 * 60 * 1000;

function unstickGames(): void {
  for (const lobby of stalledLobbies(Date.now(), STALL_GRACE_MS)) {
    const lateMs = Date.now() - lobby.deadlineMs;
    const late = Math.round(lateMs / 1000);
    const why = lateMs > CLOCK_JUMP_MS ? " (the clock jumped — was the machine asleep?)" : "";
    console.error(`[stall] ${lobby.code} stuck in ${lobby.phase} ${late}s past its deadline${why} — moving it on`);
    clearLobbyTimer(lobby);
    try {
      switch (lobby.phase) {
        case "prompt_writing": finishPromptWriting(lobby); break;
        case "drawing": finishDrawingRound(lobby); break;
        case "voting": finishVoting(lobby); break;
        case "reveal": nextRound(lobby); break;
      }
    } catch (err) {
      console.error(`[stall] ${lobby.code} could not be moved on:`, err);
    }
  }
}
setInterval(unstickGames, 15_000).unref();

// A drawing is well under 100KB; ws's default ceiling is 100MB per frame,
// which is a hundred megabytes any one phone could make this process hold.
const MAX_MESSAGE_BYTES = 1024 * 1024;
const wss = new WebSocketServer({ port: PORT, maxPayload: MAX_MESSAGE_BYTES });

// Lobbies live in this process, so this process going down is every game in
// progress going down. A bug in one handler must not be allowed to do that:
// log it, keep serving. Both of these are the last line, not the first — every
// message handler below is also wrapped individually.
process.on("uncaughtException", (err) => {
  console.error("[fatal-averted] uncaught exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[fatal-averted] unhandled rejection:", reason);
});

/** Gallery page size. A human drawing is a few KB, so this is a few hundred
 *  KB a page — fine on a phone, and the client asks for more as you scroll. */
const DAILY_PAGE = 20;

/** Every finished day with entries gets its top three frozen and paid,
 *  exactly once. Called when the hall is opened and on the daily prune. */
function freezeFinishedDays(): void {
  const today = dayOf(Date.now());
  for (const day of store.unfrozenDays(today)) {
    if (store.freezeDay(day, promptForDay(day))) {
      console.log(`[daily] froze day ${day} into the hall of fame`);
    }
  }
}

function sendDailyInfo(ws: WebSocket, playerId: string): void {
  const { day, prompt, endsAtMs } = dailyFor();
  send(ws, {
    type: "daily_info",
    day,
    prompt,
    endsAtMs,
    submitted: store.hasSubmittedDaily(day, playerId),
    submissions: store.countDaily(day),
    mine: store.myDailyEntry(day, playerId),
  });
}

function send(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function sendError(ws: WebSocket, text: string) {
  send(ws, { type: "error", message: text });
}

function broadcast(lobby: Lobby, message: ServerMessage) {
  for (const ws of lobbySockets(lobby)) send(ws, message);
}

function broadcastLobbyState(lobby: Lobby) {
  broadcast(lobby, {
    type: "lobby_state",
    code: lobby.code,
    hostId: lobby.hostId,
    mode: lobby.mode,
    players: playerInfos(lobby),
    visibility: lobby.visibility,
  });
  // Anything that changes a lobby — someone joining, a bot being added, the
  // game starting — changes what the browser should be showing.
  notifyBrowsers();
}

// --- lobby browser ---------------------------------------------------------
// Sockets sitting on the menu with the browser open. Pushing to them beats
// polling: a lobby shows up the moment it is opened, and an empty menu costs
// nothing. The set is the only state involved, and a closed socket drops out
// of it in the disconnect handler.
const browsers = new Set<WebSocket>();

function notifyBrowsers() {
  if (browsers.size === 0) return;
  const lobbies = openLobbies();
  for (const ws of browsers) send(ws, { type: "lobby_list", lobbies });
}

function broadcastWaiting(lobby: Lobby, submitted: number, total: number) {
  broadcast(lobby, { type: "waiting_update", submitted, total });
}

// --- identity --------------------------------------------------------------
// Every connection must say who it is before it can do anything. The id is
// generated once on the device and kept until the app is deleted, which is
// what lets profiles and the leaderboard exist at all.

type Identity = { playerId: string; nickname: string };
const identities = new Map<WebSocket, Identity>();

function profileFor(playerId: string): Profile | null {
  const p = store.getProfile(playerId);
  if (!p) return null;
  // The stored row carries bookkeeping the client has no use for (bestLeague is
  // an internal floor marker); the wire shape sends the derived league instead.
  const { bestLeague: _bestLeague, ...rest } = p;
  return {
    ...rest,
    rank: store.rankOf(playerId),
    league: leagueFor(p.rating),
    placementsLeft: Math.max(0, PLACEMENT_GAMES - p.seasonGames),
    seasonEndsMs: seasonEndsAt(),
  };
}

function sendAccount(ws: WebSocket, playerId: string) {
  send(ws, {
    type: "account",
    playerId,
    linked: store.getProfile(playerId)?.linked ?? false,
    googleAvailable: googleEnabled,
  });
}

function sendProfile(ws: WebSocket, playerId: string) {
  const profile = profileFor(playerId);
  if (profile) send(ws, { type: "profile", profile });
}

// --- phase transitions -----------------------------------------------------

function beginGame(lobby: Lobby) {
  startWriterRotation(lobby);
  startWriterTurn(lobby);
}

function startWriterTurn(lobby: Lobby) {
  // The rotation is fixed at game start; skip anyone who's since left rather
  // than crashing on a writer who no longer exists.
  while (currentWriterId(lobby) && !lobby.players.has(currentWriterId(lobby)!)) {
    if (!advanceRound(lobby)) {
      finishGame(lobby);
      return;
    }
  }
  const writerId = currentWriterId(lobby);
  if (!writerId) {
    finishGame(lobby);
    return;
  }

  beginPromptWriting(lobby);
  clearBotTimers(lobby);
  const writer = lobby.players.get(writerId)!;
  const deadlineMs = setPhaseTimer(lobby, PROMPT_SECONDS, () => finishPromptWriting(lobby));
  for (const player of lobby.players.values()) {
    if (player.ws) {
      send(player.ws, {
        type: "prompt_writing",
        template: lobby.currentTemplate,
        writerId,
        writerName: writer.nickname,
        isWriter: player.id === writerId,
        deadlineMs,
        roundIndex: lobby.roundIndex,
        totalRounds: totalRounds(lobby),
      });
    }
  }
  console.log(`[phase] ${lobby.code} prompt_writing (${writer.nickname})`);
}

function finishPromptWriting(lobby: Lobby) {
  if (lobby.phase !== "prompt_writing") return;
  if (!lobby.completedPrompt) {
    // Writer never answered (timed out, or left) — use a generic filler so
    // the round can still proceed instead of stalling everyone else.
    recordPrompt(lobby, "");
  }
  beginDrawingRound(lobby);
  clearBotTimers(lobby);
  const deadlineMs = setPhaseTimer(lobby, DRAW_SECONDS, () => finishDrawingRound(lobby));
  broadcast(lobby, {
    type: "round_start",
    prompt: lobby.completedPrompt,
    deadlineMs,
    roundIndex: lobby.roundIndex,
    totalRounds: totalRounds(lobby),
  });
  console.log(`[phase] ${lobby.code} drawing "${lobby.completedPrompt}"`);

  const prompt = lobby.completedPrompt;
  const answer = lobby.promptAnswer;
  for (const id of botIds(lobby)) {
    scheduleBotAction(lobby, botDelayMs(DRAW_SECONDS), () => {
      if (lobby.phase !== "drawing") return;
      recordDrawing(lobby, id, botTitle(prompt), botDrawing(prompt, answer, id));
      broadcastWaiting(lobby, lobby.roundDrawings.size, lobby.players.size);
      if (everyoneDrew(lobby)) finishDrawingRound(lobby);
    });
  }
}

function finishDrawingRound(lobby: Lobby) {
  if (lobby.phase !== "drawing") return;
  beginVoting(lobby);
  const entries = drawingEntries(lobby);
  if (entries.length === 0) {
    // Nobody submitted anything this round — nothing to vote on.
    nextRound(lobby);
    return;
  }
  // Extra time up front for the client's one-at-a-time presentation of each
  // drawing before the interactive voting screen appears.
  const presentationSeconds = Math.ceil(entries.length * PRESENT_SECONDS_PER_ENTRY);
  const deadlineMs = setPhaseTimer(lobby, INVEST_SECONDS + presentationSeconds, () =>
    finishVoting(lobby),
  );
  clearBotTimers(lobby);
  const scoring = scoringFor(lobby);
  broadcast(lobby, {
    type: "voting_phase",
    scoring,
    prompt: lobby.completedPrompt,
    entries,
    budget: INVESTMENT_BUDGET,
    step: INVESTMENT_STEP,
    places: RANKING_POINTS.length,
    deadlineMs,
    roundIndex: lobby.roundIndex,
    totalRounds: totalRounds(lobby),
  });
  console.log(`[phase] ${lobby.code} voting/${scoring} (${entries.length} entries)`);

  // Bots wait out the presentation too, so they don't finish before a human
  // has even seen the drawings.
  for (const id of botIds(lobby)) {
    const delay = presentationSeconds * 1000 + botDelayMs(INVEST_SECONDS);
    scheduleBotAction(lobby, delay, () => {
      if (lobby.phase !== "voting") return;
      if (scoring === "money") {
        recordInvestment(lobby, id, botInvestment(entries, id, INVESTMENT_BUDGET, INVESTMENT_STEP));
      } else {
        recordRanking(lobby, id, botRanking(entries, id, RANKING_POINTS.length));
      }
      broadcastWaiting(lobby, voteCount(lobby), lobby.players.size);
      if (everyoneVoted(lobby)) finishVoting(lobby);
    });
  }
}

function finishVoting(lobby: Lobby) {
  if (lobby.phase !== "voting") return;
  clearBotTimers(lobby);
  const entries = scoreRoundAndBuildReveal(lobby);
  const scoring = scoringFor(lobby);
  broadcast(lobby, {
    type: "round_reveal",
    scoring,
    fundingGoal: scoring === "money" ? FUNDING_GOAL : null,
    prompt: lobby.completedPrompt,
    entries,
    scores: scoreRows(lobby),
    roundIndex: lobby.roundIndex,
    totalRounds: totalRounds(lobby),
  });
  console.log(`[phase] ${lobby.code} reveal (${entries.length} entries)`);
  // Every drawing gets its own moment on screen before the scoreboard, so the
  // phase has to outlast the whole showcase rather than a fixed 14 seconds.
  const showcaseSeconds = Math.ceil(entries.length * SHOWCASE_SECONDS_PER_ENTRY);
  setPhaseTimer(lobby, REVEAL_SECONDS + showcaseSeconds, () => nextRound(lobby));
}

function nextRound(lobby: Lobby) {
  // Logged so a game that stops here leaves a trace of whether its reveal
  // timer ever fired — the one question a stalled-game report can't answer.
  console.log(`[phase] ${lobby.code} reveal over (round ${lobby.roundIndex + 1}/${totalRounds(lobby)})`);
  if (advanceRound(lobby)) {
    startWriterTurn(lobby);
  } else {
    finishGame(lobby);
  }
}

function finishGame(lobby: Lobby) {
  clearLobbyTimer(lobby);
  clearBotTimers(lobby);
  lobby.phase = "results";

  const rows = scoreRows(lobby);
  // Only ranked games touch the leaderboard — friendly ones are played against
  // people you chose and bots you added, so they'd be trivial to farm.
  const trophies = trophiesForGame(lobby);
  let ratingDeltas: Record<string, number> | undefined;
  let leagues: Record<string, LeagueInfo> | undefined;

  if (lobby.mode === "ranked") {
    const winnerId = rows[0]?.playerId;

    // Ratings are read for everyone *before* any are written, so each player is
    // rated against the table as it stood at kick-off. Updating as we go would
    // make the result depend on the order we happened to iterate in.
    const before = new Map<string, { rating: number; gamesPlayed: number }>();
    for (const row of rows) {
      const profile = store.getProfile(row.playerId);
      if (profile) before.set(row.playerId, { rating: profile.rating, gamesPlayed: profile.seasonGames });
    }

    const changes = ratingsForGame(lobby, before);
    ratingDeltas = {};
    leagues = {};

    for (const change of changes) {
      const earned = trophies[change.playerId];
      if (earned === undefined) continue; // bot
      const updated = store.recordRankedResult(change.playerId, {
        trophies: earned,
        won: change.playerId === winnerId,
        score: rows.find((r) => r.playerId === change.playerId)?.score ?? 0,
        rating: change.after,
      });
      if (!updated) continue;
      // Report the delta the floor actually allowed, not the raw one — telling
      // someone they lost 14 points when protection absorbed it would be a lie.
      ratingDeltas[change.playerId] = updated.rating - change.before;
      leagues[change.playerId] = leagueFor(updated.rating);
    }
  }

  broadcast(lobby, {
    type: "final_results",
    mode: lobby.mode,
    scores: rows,
    trophies,
    ratingDeltas,
    leagues,
  });
  // Fresh trophy counts and global rank, so the home screen is right the
  // moment they back out of the game.
  if (lobby.mode === "ranked") {
    for (const player of lobby.players.values()) {
      if (player.ws) sendProfile(player.ws, player.id);
    }
  }
  console.log(`[phase] ${lobby.code} results (${lobby.mode})`);
}

/** After someone leaves mid-phase, the remaining players may already have all
 *  responded — don't leave them staring at a timer for no reason. */
function recheckPhaseProgress(lobby: Lobby) {
  switch (lobby.phase) {
    case "prompt_writing":
      if (!lobby.players.has(currentWriterId(lobby) ?? "")) {
        // The writer left before answering — fall back and move on.
        finishPromptWriting(lobby);
      }
      break;
    case "drawing":
      if (everyoneDrew(lobby)) finishDrawingRound(lobby);
      break;
    case "voting":
      if (everyoneVoted(lobby)) finishVoting(lobby);
      break;
    default:
      break;
  }
}

// --- ranked matchmaking ----------------------------------------------------

queue.startMatchmaker({
  onMatch(members, botsNeeded) {
    const lobby = createRankedLobby(members);
    for (let i = 0; i < botsNeeded; i++) addBot(lobby);
    console.log(
      `[match] ${lobby.code} ${members.length} human(s) + ${botsNeeded} bot(s)`,
    );
    broadcastLobbyState(lobby);
    // Ranked games start themselves — there's no host to press a button, and
    // nobody chose these opponents. A short beat first so players actually see
    // who they drew before the first prompt lands on top of it.
    setPhaseTimer(lobby, RANKED_START_DELAY_SECONDS, () => beginGame(lobby));
  },
  onTick() {
    const waiting = queue.queued();
    if (waiting.length === 0) return;
    const status: ServerMessage = {
      type: "queue_status",
      waiting: waiting.length,
      target: queue.MATCH_SIZE,
      botFillAtMs: queue.botFillAtMs(),
    };
    for (const w of waiting) send(w.ws, status);
  },
});

// --- connection handling ---------------------------------------------------

wss.on("connection", (ws) => {
  const connectionId = randomUUID();
  const limit = new RateLimit();
  console.log(`[connect] ${connectionId}`);
  send(ws, { type: "welcome", connectionId });

  // ws reports a frame over `maxPayload` (and any transport fault) as an
  // 'error' event, then closes the socket. Without a listener that event is
  // rethrown as an uncaught exception — so this is what turns "one phone sent
  // a 5MB frame" into a log line about that one phone instead of a process
  // event. The 'close' handler below does the actual cleanup.
  ws.on("error", (err) => {
    console.warn(`[socket] ${connectionId}: ${err.message}`);
  });

  ws.on("message", (raw) => {
    if (!limit.allow()) {
      // Nothing in the game sends dozens of messages a second. A client that
      // does is broken or hostile; after enough of it, stop paying for it.
      if (limit.dropped > 500) ws.close(1008, "Too many messages");
      return;
    }

    let message: ClientMessage;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (typeof message !== "object" || message === null || typeof message.type !== "string") return;

    try {
      handle(ws, message);
    } catch (err) {
      // One malformed message from one phone must never take the process —
      // and every game in it — down with it.
      console.error(`[handler] ${connectionId} ${message.type}:`, err);
      sendError(ws, "That didn't work — try again");
    }
  });

  function handle(ws: WebSocket, message: ClientMessage): void {
    // Two messages work without an identity: the handshake itself, and the
    // idle-canvas doodle the home screen shows before anyone signs in.
    if (message.type === "hello") {
      const nickname = cleanText(message.nickname, 16);
      const playerId = cleanText(message.playerId, 64);
      if (!playerId) return sendError(ws, "Missing player id");
      if (!nickname) return sendError(ws, "Enter a nickname first");
      // A socket is one person. Re-sending hello with the same id is harmless
      // (the app does it on reconnect); switching ids mid-connection is not a
      // thing a real client does, and it is how a script would farm profiles.
      const existing = identities.get(ws);
      if (existing && existing.playerId !== playerId) {
        return sendError(ws, "Reconnect to sign in as someone else");
      }
      identities.set(ws, { playerId, nickname });
      store.upsertPlayer(playerId, nickname);
      sendAccount(ws, playerId);
      sendProfile(ws, playerId);
      console.log(`[hello] ${nickname} (${playerId.slice(0, 8)})`);
      return;
    }

    if (message.type === "ping") {
      send(ws, { type: "pong", serverTimeMs: Date.now() });
      return;
    }

    if (message.type === "request_doodle") {
      // Pure decoration for players who are waiting — intentionally has no
      // lobby, phase or identity requirement, so the home screen can show one
      // before anybody has signed in.
      const prompt = pickDemoPrompt();
      send(ws, {
        type: "doodle",
        prompt,
        artistName: randomBotName(),
        title: botTitle(prompt),
        // No writer for these, so the whole sentence is the signal.
        strokes: botDrawing(prompt, "", randomUUID()),
      });
      return;
    }

    const identity = identities.get(ws);
    if (!identity) return sendError(ws, "Not signed in");
    const { playerId } = identity;

    switch (message.type) {
      case "set_nickname": {
        const nickname = cleanText(message.nickname, 16);
        if (!nickname) return sendError(ws, "Enter a nickname first");
        identity.nickname = nickname;
        store.upsertPlayer(playerId, nickname);
        // Keep the name in sync wherever they're already sitting.
        const lobby = getLobbyByPlayer(playerId);
        const seated = lobby?.players.get(playerId);
        if (lobby && seated) {
          seated.nickname = nickname;
          broadcastLobbyState(lobby);
        }
        sendProfile(ws, playerId);
        break;
      }

      case "daily_info": {
        sendDailyInfo(ws, playerId);
        break;
      }

      case "daily_upcoming": {
        // Fourteen days: enough that a phone opened once a week never runs
        // out of scheduled reminders, and few enough that a stale cache on a
        // phone nobody opens stops nagging on its own.
        const today = dayOf(Date.now());
        send(ws, {
          type: "daily_upcoming",
          days: Array.from({ length: 14 }, (_, i) => ({
            day: today + i,
            prompt: promptForDay(today + i),
            startsAtMs: (today + i) * 24 * 60 * 60 * 1000,
          })),
        });
        break;
      }

      case "daily_submit": {
        const { day, prompt } = dailyFor();
        const title = maskProfanity(cleanText(message.title, 40));
        const strokes = sanitizeStrokes(message.strokes);
        if (strokes.length === 0) return sendError(ws, "Draw something first");
        if (!title) return sendError(ws, "Give it a title");
        const paper = cleanText(message.paper, 16) || undefined;
        store.submitDaily({
          day,
          playerId,
          nickname: identity.nickname,
          title,
          paper,
          strokes,
        });
        // The daily is a labelled drawing like any other, so it goes in
        // the long-term archive too. No blank was filled in, hence the
        // empty answer; nobody judged it, hence raised 0.
        try {
          store.archiveDrawings([{ playerId, prompt, answer: "", title, paper, raised: 0, strokes }]);
        } catch (err) {
          console.error("could not archive a daily drawing:", err);
        }
        console.log(`[daily] ${identity.nickname} drew day ${day}`);
        sendDailyInfo(ws, playerId);
        break;
      }

      case "daily_gallery": {
        const day = asInt(message.day) ?? dayOf(Date.now());
        if (day > dayOf(Date.now())) return sendError(ws, "That day hasn't happened yet");
        if (!store.hasSubmittedDaily(day, playerId)) {
          return sendError(ws, "Draw the prompt first, then you can see everyone else's");
        }
        const beforeId = asInt(message.beforeId);
        const page = store.dailyGalleryWithHearts(day, playerId, beforeId, DAILY_PAGE);
        // Blind while the day is open. Seeing a name or a running count
        // before you've looked at the drawing is how the early leader
        // snowballs (people heart what is already winning); stripping both
        // here, not in the app, means no client can peek.
        const blind = day === dayOf(Date.now());
        const entries = blind ? store.blindEntries(page.entries, playerId) : page.entries;
        let yesterday: HallDay | null = null;
        if (beforeId === null) {
          freezeFinishedDays();
          yesterday = store.hallOfFame(day, 1, playerId).days.find((d) => d.day === day - 1) ?? null;
        }
        send(ws, {
          type: "daily_gallery",
          day,
          prompt: promptForDay(day),
          blind,
          yesterday,
          entries,
          hasMore: page.hasMore,
        });
        break;
      }

      case "daily_heart": {
        const today = dayOf(Date.now());
        // The gallery is for people who drew; so are its hearts.
        if (!store.hasSubmittedDaily(today, playerId)) {
          return sendError(ws, "Draw today's prompt first");
        }
        const entryId = asInt(message.entryId);
        if (entryId === null) return;
        const result = store.heartDaily(today, entryId, playerId);
        if (!result.ok) {
          if (result.reason === "own") return sendError(ws, "You can't heart your own drawing");
          if (result.reason === "already") return; // idempotent: the button just stays lit
          return sendError(ws, "That drawing isn't in today's gallery");
        }
        // The count stays hidden while the day is open, like the wall.
        send(ws, { type: "daily_hearted", entryId, hearts: 0 });
        break;
      }

      case "daily_history": {
        // Freeze any day that has ended and never been frozen. Lazy rather
        // than scheduled: the first person to open the hall after midnight
        // does the work, and it is a few rows.
        freezeFinishedDays();
        const beforeDay = asInt(message.beforeDay);
        const page = store.hallOfFame(beforeDay, 14, playerId);
        send(ws, { type: "daily_history", days: page.days, hasMore: page.hasMore });
        break;
      }

      case "report_drawing": {
        const reason = cleanText(message.reason, 200);
        if (!reason) return sendError(ws, "Say what's wrong with it");
        const entryId = asInt(message.entryId);
        let artistId = typeof message.artistId === "string" ? cleanText(message.artistId, 64) : "";
        let title = typeof message.title === "string" ? cleanText(message.title, 40) : "";
        if (entryId !== null) {
          const found = store.artistOfEntry(entryId);
          if (!found) return sendError(ws, "That drawing is gone");
          artistId = found.artistId;
          title = found.title;
        }
        if (!artistId) return;
        store.reportDrawing({ reporterId: playerId, artistId, entryId, title, reason });
        console.log(`[report] ${identity.nickname} reported ${artistId} (${title}): ${reason}`);
        send(ws, { type: "reported" });
        break;
      }

      case "hide_artist": {
        const entryId = asInt(message.entryId);
        let artistId = typeof message.artistId === "string" ? cleanText(message.artistId, 64) : "";
        if (entryId !== null) {
          const found = store.artistOfEntry(entryId);
          if (!found) return sendError(ws, "That drawing is gone");
          artistId = found.artistId;
        }
        if (!artistId) return;
        if (!store.hideArtist(playerId, artistId)) return sendError(ws, "That's you");
        send(ws, { type: "artist_hidden", artistId, entryId });
        break;
      }

      case "unhide_artist": {
        const artistId = cleanText(message.artistId, 64);
        if (artistId) store.unhideArtist(playerId, artistId);
        break;
      }

      case "get_leaderboard": {
        send(ws, {
          type: "leaderboard",
          entries: store.leaderboard(50).map((row) => ({
            rank: row.rank,
            id: row.id,
            nickname: row.nickname,
            trophies: row.trophies,
            games: row.games,
            wins: row.wins,
            rating: row.rating,
            league: leagueFor(row.rating),
          })),
          you: profileFor(playerId),
        });
        break;
      }

      case "find_match": {
        if (getLobbyByPlayer(playerId)) return sendError(ws, "You're already in a game");
        queue.enqueue({ playerId, ws, nickname: identity.nickname });
        send(ws, {
          type: "queue_status",
          waiting: queue.queued().length,
          target: queue.MATCH_SIZE,
          botFillAtMs: queue.botFillAtMs(),
        });
        console.log(`[queue] +${identity.nickname} (${queue.queued().length} waiting)`);
        break;
      }

      case "cancel_match": {
        queue.dequeue(playerId);
        console.log(`[queue] -${identity.nickname} (${queue.queued().length} waiting)`);
        break;
      }

      case "create_lobby": {
        if (getLobbyByPlayer(playerId)) return sendError(ws, "You're already in a lobby");
        queue.dequeue(playerId);
        // Opening a lobby means you have stopped shopping for one.
        browsers.delete(ws);
        const lobby = createFriendlyLobby(
          { playerId, ws, nickname: identity.nickname },
          message.visibility ?? "public",
        );
        console.log(`[create_lobby] ${identity.nickname} -> ${lobby.code} (${lobby.visibility})`);
        broadcastLobbyState(lobby);
        break;
      }

      case "join_lobby": {
        if (getLobbyByPlayer(playerId)) return sendError(ws, "You're already in a lobby");
        queue.dequeue(playerId);
        try {
          const member: Member = { playerId, ws, nickname: identity.nickname };
          const lobby = joinLobby(cleanText(message.code, 8), member);
          browsers.delete(ws);
          console.log(`[join_lobby] ${identity.nickname} -> ${lobby.code}`);
          broadcastLobbyState(lobby);
        } catch (err) {
          sendError(ws, (err as Error).message);
        }
        break;
      }

      case "link_google": {
        if (!googleEnabled) {
          return sendError(ws, "This server has no Google sign-in configured");
        }
        // Switching profiles underneath a running game would leave the lobby
        // holding an id that no longer exists.
        if (getLobbyByPlayer(playerId)) {
          return sendError(ws, "Finish your game before signing in");
        }
        const token = typeof message.idToken === "string" ? message.idToken : "";
        if (!token) return sendError(ws, "Missing sign-in token");

        void verifyGoogle(token).then((user) => {
          if (ws.readyState !== ws.OPEN) return;
          if (!user) return sendError(ws, "Could not verify that Google account");
          // Re-read the identity: the socket may have been reused, or the
          // player renamed, while the token was being checked.
          const current = identities.get(ws);
          if (!current) return;

          const profile = store.linkGoogle(current.playerId, user.sub);
          // linkGoogle can move the player onto an account that already
          // existed, which changes their id for the rest of this connection.
          identities.set(ws, { playerId: profile.id, nickname: current.nickname });
          if (profile.id !== current.playerId) {
            console.log(`[link_google] ${current.nickname} -> existing account ${profile.id.slice(0, 8)}`);
          } else {
            console.log(`[link_google] ${current.nickname} linked`);
          }
          sendAccount(ws, profile.id);
          sendProfile(ws, profile.id);
        });
        break;
      }

      case "unlink_google": {
        store.unlinkGoogle(playerId);
        console.log(`[unlink_google] ${identity.nickname}`);
        sendAccount(ws, playerId);
        sendProfile(ws, playerId);
        break;
      }

      case "list_lobbies": {
        browsers.add(ws);
        send(ws, { type: "lobby_list", lobbies: openLobbies() });
        break;
      }

      case "stop_browsing": {
        browsers.delete(ws);
        break;
      }

      case "set_visibility": {
        const lobby = getLobbyByPlayer(playerId);
        if (!lobby) return sendError(ws, "You're not in a lobby");
        if (lobby.hostId !== playerId) return sendError(ws, "Only the host can do that");
        if (!setVisibility(lobby, message.visibility)) {
          return sendError(ws, "The game already started");
        }
        broadcastLobbyState(lobby);
        break;
      }

      case "start_game": {
        const lobby = getLobbyByPlayer(playerId);
        if (!lobby) return sendError(ws, "You're not in a lobby");
        if (lobby.phase !== "lobby") return sendError(ws, "The game already started");
        if (lobby.hostId !== playerId) return sendError(ws, "Only the host can start");
        if (lobby.players.size < MIN_PLAYERS_TO_START) {
          return sendError(ws, `Need at least ${MIN_PLAYERS_TO_START} players`);
        }
        beginGame(lobby);
        break;
      }

      case "add_bot": {
        const lobby = getLobbyByPlayer(playerId);
        if (!lobby) return sendError(ws, "You're not in a lobby");
        if (lobby.mode !== "friendly") return sendError(ws, "Ranked games fill themselves");
        if (lobby.hostId !== playerId) return sendError(ws, "Only the host can add players");
        if (lobby.phase !== "lobby") return sendError(ws, "The game already started");
        const bot = addBot(lobby);
        if (!bot) return sendError(ws, "The lobby is full");
        console.log(`[add_bot] ${lobby.code} +${bot.nickname}`);
        broadcastLobbyState(lobby);
        break;
      }

      case "remove_bot": {
        const lobby = getLobbyByPlayer(playerId);
        if (!lobby) return sendError(ws, "You're not in a lobby");
        if (lobby.hostId !== playerId) return sendError(ws, "Only the host can remove players");
        if (lobby.phase !== "lobby") return sendError(ws, "The game already started");
        if (!removeBot(lobby)) return sendError(ws, "There are no bots to remove");
        console.log(`[remove_bot] ${lobby.code}`);
        broadcastLobbyState(lobby);
        break;
      }

      case "submit_prompt": {
        const lobby = getLobbyByPlayer(playerId);
        if (!lobby || lobby.phase !== "prompt_writing") return;
        if (playerId !== currentWriterId(lobby)) return;
        const text = cleanText(message.text, 60);
        if (!text) return sendError(ws, "Fill in the blank first");
        // Rejected rather than masked: the writer still has the clock and can
        // reword. (If they don't, the timeout fills the blank generically, so
        // a refusal can never stall the round.) The app unlocks the box again
        // on this error.
        if (hasProfanity(text)) return sendError(ws, "Keep it clean — try other words");
        recordPrompt(lobby, text);
        finishPromptWriting(lobby); // no need to make everyone wait out the clock
        break;
      }

      case "submit_drawing": {
        const lobby = getLobbyByPlayer(playerId);
        if (!lobby || lobby.phase !== "drawing") return;
        // Cleaned here, once, before it is stored, scored, archived and sent
        // to four other phones. A blank submission is still a submission —
        // the round has to be able to move on past someone who drew nothing.
        // Titles are masked, not refused: the title arrives with the drawing,
        // and losing 75 seconds of drawing over its name would be the worse
        // outcome. The drawing itself is never inspected.
        recordDrawing(
          lobby,
          playerId,
          maskProfanity(cleanText(message.title, 40)),
          sanitizeStrokes(message.strokes),
          cleanText(message.paper, 16) || undefined,
        );
        broadcastWaiting(lobby, lobby.roundDrawings.size, lobby.players.size);
        if (everyoneDrew(lobby)) finishDrawingRound(lobby);
        break;
      }

      case "submit_investment": {
        const lobby = getLobbyByPlayer(playerId);
        if (!lobby || lobby.phase !== "voting" || scoringFor(lobby) !== "money") return;
        if (typeof message.allocations !== "object" || message.allocations === null) return;
        recordInvestment(lobby, playerId, message.allocations);
        broadcastWaiting(lobby, voteCount(lobby), lobby.players.size);
        if (everyoneVoted(lobby)) finishVoting(lobby);
        break;
      }

      case "submit_ranking": {
        const lobby = getLobbyByPlayer(playerId);
        if (!lobby || lobby.phase !== "voting" || scoringFor(lobby) !== "points") return;
        if (!Array.isArray(message.order)) return;
        recordRanking(lobby, playerId, message.order.filter((id) => typeof id === "string"));
        broadcastWaiting(lobby, voteCount(lobby), lobby.players.size);
        if (everyoneVoted(lobby)) finishVoting(lobby);
        break;
      }

      case "play_again": {
        const lobby = getLobbyByPlayer(playerId);
        if (!lobby) return sendError(ws, "You're not in a lobby");
        if (lobby.mode !== "friendly") return sendError(ws, "Queue again for another ranked game");
        if (lobby.hostId !== playerId) return sendError(ws, "Only the host can restart");
        if (lobby.phase !== "results") return sendError(ws, "The game is still running");
        resetToLobby(lobby);
        console.log(`[play_again] ${lobby.code}`);
        broadcastLobbyState(lobby);
        break;
      }

      case "leave_lobby": {
        const lobby = leaveLobby(playerId);
        if (lobby) {
          if (lobby.phase === "lobby") broadcastLobbyState(lobby);
          else recheckPhaseProgress(lobby);
        }
        // Also when `lobby` is undefined: that means the last player left and
        // it was deleted, which is exactly when the browser is showing a game
        // that no longer exists.
        notifyBrowsers();
        break;
      }
    }
  }

  ws.on("close", () => {
    console.log(`[disconnect] ${connectionId}`);
    browsers.delete(ws);
    const identity = identities.get(ws);
    identities.delete(ws);
    if (!identity) return;

    queue.dequeue(identity.playerId);
    const lobby = leaveLobby(identity.playerId);
    if (!lobby) {
      notifyBrowsers();
      return;
    }
    if (lobby.phase === "lobby") {
      broadcastLobbyState(lobby);
    } else {
      recheckPhaseProgress(lobby);
    }
  });
});

console.log(`Grand Canvas server listening on ws://0.0.0.0:${PORT}`);
console.log(`Leaderboard stored at ${DB_PATH}`);
advertiseOnLocalNetwork(PORT);
