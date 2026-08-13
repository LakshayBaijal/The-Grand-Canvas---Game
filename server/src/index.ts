import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import { advertiseOnLocalNetwork } from "./discovery.js";
import type { ClientMessage, ServerMessage } from "./types.js";
import { botDelayMs, botDrawing, botInvestment, botTitle } from "./bots.js";
import {
  DRAW_SECONDS,
  INVEST_SECONDS,
  INVESTMENT_BUDGET,
  INVESTMENT_STEP,
  MIN_PLAYERS_TO_START,
  PRESENT_SECONDS_PER_ENTRY,
  PROMPT_SECONDS,
  REVEAL_SECONDS,
  addBot,
  advanceRound,
  beginDrawingRound,
  beginInvesting,
  beginPromptWriting,
  botIds,
  clearBotTimers,
  clearLobbyTimer,
  createLobby,
  currentWriterId,
  drawingEntries,
  everyoneDrew,
  everyoneInvested,
  getLobbyByPlayer,
  joinLobby,
  leaveLobby,
  lobbySockets,
  playerInfos,
  quickPlay,
  recordDrawing,
  recordInvestment,
  recordPrompt,
  removeBot,
  resetToLobby,
  scheduleBotAction,
  scoreRoundAndBuildReveal,
  scoreRows,
  setPhaseTimer,
  startWriterRotation,
  totalRounds,
  type Lobby,
} from "./rooms.js";

const PORT = Number(process.env.PORT ?? 8090);
const wss = new WebSocketServer({ port: PORT });

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
    players: playerInfos(lobby),
  });
}

function broadcastWaiting(lobby: Lobby, submitted: number, total: number) {
  broadcast(lobby, { type: "waiting_update", submitted, total });
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
  for (const id of botIds(lobby)) {
    scheduleBotAction(lobby, botDelayMs(DRAW_SECONDS), () => {
      if (lobby.phase !== "drawing") return;
      recordDrawing(lobby, id, botTitle(prompt), botDrawing(prompt, id));
      broadcastWaiting(lobby, lobby.roundDrawings.size, lobby.players.size);
      if (everyoneDrew(lobby)) finishDrawingRound(lobby);
    });
  }
}

function finishDrawingRound(lobby: Lobby) {
  if (lobby.phase !== "drawing") return;
  beginInvesting(lobby);
  const entries = drawingEntries(lobby);
  if (entries.length === 0) {
    // Nobody submitted anything this round — nothing to invest in.
    nextRound(lobby);
    return;
  }
  // Extra time up front for the client's one-at-a-time presentation of each
  // drawing before the interactive investing screen appears.
  const presentationSeconds = Math.ceil(entries.length * PRESENT_SECONDS_PER_ENTRY);
  const deadlineMs = setPhaseTimer(
    lobby,
    INVEST_SECONDS + presentationSeconds,
    () => finishInvesting(lobby),
  );
  clearBotTimers(lobby);
  broadcast(lobby, {
    type: "investing_phase",
    prompt: lobby.completedPrompt,
    entries,
    budget: INVESTMENT_BUDGET,
    step: INVESTMENT_STEP,
    deadlineMs,
    roundIndex: lobby.roundIndex,
    totalRounds: totalRounds(lobby),
  });
  console.log(`[phase] ${lobby.code} investing (${entries.length} entries)`);

  // Bots wait out the presentation too, so they don't finish before a human
  // has even seen the drawings.
  for (const id of botIds(lobby)) {
    const delay = presentationSeconds * 1000 + botDelayMs(INVEST_SECONDS);
    scheduleBotAction(lobby, delay, () => {
      if (lobby.phase !== "investing") return;
      recordInvestment(lobby, id, botInvestment(entries, id, INVESTMENT_BUDGET, INVESTMENT_STEP));
      broadcastWaiting(lobby, lobby.investments.size, lobby.players.size);
      if (everyoneInvested(lobby)) finishInvesting(lobby);
    });
  }
}

function finishInvesting(lobby: Lobby) {
  if (lobby.phase !== "investing") return;
  clearBotTimers(lobby);
  const entries = scoreRoundAndBuildReveal(lobby);
  broadcast(lobby, {
    type: "round_reveal",
    prompt: lobby.completedPrompt,
    entries,
    scores: scoreRows(lobby),
    roundIndex: lobby.roundIndex,
    totalRounds: totalRounds(lobby),
  });
  console.log(`[phase] ${lobby.code} reveal`);
  setPhaseTimer(lobby, REVEAL_SECONDS, () => nextRound(lobby));
}

function nextRound(lobby: Lobby) {
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
  broadcast(lobby, { type: "final_results", scores: scoreRows(lobby) });
  console.log(`[phase] ${lobby.code} results`);
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
    case "investing":
      if (everyoneInvested(lobby)) finishInvesting(lobby);
      break;
    default:
      break;
  }
}

// --- connection handling ---------------------------------------------------

wss.on("connection", (ws) => {
  const connectionId = randomUUID();
  console.log(`[connect] ${connectionId}`);
  send(ws, { type: "welcome", connectionId });

  ws.on("message", (raw) => {
    let message: ClientMessage;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (message.type) {
      case "ping":
        send(ws, { type: "pong", serverTimeMs: Date.now() });
        break;

      case "create_lobby":
      case "quick_play": {
        const nickname = message.nickname.trim().slice(0, 16);
        if (!nickname) return sendError(ws, "Enter a nickname first");
        if (getLobbyByPlayer(connectionId)) return sendError(ws, "You're already in a lobby");
        const lobby =
          message.type === "create_lobby"
            ? createLobby(connectionId, ws, nickname)
            : quickPlay(connectionId, ws, nickname);
        console.log(`[${message.type}] ${nickname} -> ${lobby.code}`);
        broadcastLobbyState(lobby);
        break;
      }

      case "join_lobby": {
        const nickname = message.nickname.trim().slice(0, 16);
        if (!nickname) return sendError(ws, "Enter a nickname first");
        if (getLobbyByPlayer(connectionId)) return sendError(ws, "You're already in a lobby");
        try {
          const lobby = joinLobby(message.code, connectionId, ws, nickname);
          console.log(`[join_lobby] ${nickname} -> ${lobby.code}`);
          broadcastLobbyState(lobby);
        } catch (err) {
          sendError(ws, (err as Error).message);
        }
        break;
      }

      case "start_game": {
        const lobby = getLobbyByPlayer(connectionId);
        if (!lobby) return sendError(ws, "You're not in a lobby");
        if (lobby.phase !== "lobby") return sendError(ws, "The game already started");
        if (lobby.hostId !== connectionId) return sendError(ws, "Only the host can start");
        if (lobby.players.size < MIN_PLAYERS_TO_START) {
          return sendError(ws, `Need at least ${MIN_PLAYERS_TO_START} players`);
        }
        beginGame(lobby);
        break;
      }

      case "add_bot": {
        const lobby = getLobbyByPlayer(connectionId);
        if (!lobby) return sendError(ws, "You're not in a lobby");
        if (lobby.hostId !== connectionId) return sendError(ws, "Only the host can add players");
        if (lobby.phase !== "lobby") return sendError(ws, "The game already started");
        const bot = addBot(lobby);
        if (!bot) return sendError(ws, "The lobby is full");
        console.log(`[add_bot] ${lobby.code} +${bot.nickname}`);
        broadcastLobbyState(lobby);
        break;
      }

      case "remove_bot": {
        const lobby = getLobbyByPlayer(connectionId);
        if (!lobby) return sendError(ws, "You're not in a lobby");
        if (lobby.hostId !== connectionId) return sendError(ws, "Only the host can remove players");
        if (lobby.phase !== "lobby") return sendError(ws, "The game already started");
        if (!removeBot(lobby)) return sendError(ws, "There are no bots to remove");
        console.log(`[remove_bot] ${lobby.code}`);
        broadcastLobbyState(lobby);
        break;
      }

      case "submit_prompt": {
        const lobby = getLobbyByPlayer(connectionId);
        if (!lobby || lobby.phase !== "prompt_writing") return;
        if (connectionId !== currentWriterId(lobby)) return;
        recordPrompt(lobby, message.text);
        finishPromptWriting(lobby); // no need to make everyone wait out the clock
        break;
      }

      case "submit_drawing": {
        const lobby = getLobbyByPlayer(connectionId);
        if (!lobby || lobby.phase !== "drawing") return;
        recordDrawing(lobby, connectionId, message.title, message.strokes);
        broadcastWaiting(lobby, lobby.roundDrawings.size, lobby.players.size);
        if (everyoneDrew(lobby)) finishDrawingRound(lobby);
        break;
      }

      case "submit_investment": {
        const lobby = getLobbyByPlayer(connectionId);
        if (!lobby || lobby.phase !== "investing") return;
        recordInvestment(lobby, connectionId, message.allocations);
        broadcastWaiting(lobby, lobby.investments.size, lobby.players.size);
        if (everyoneInvested(lobby)) finishInvesting(lobby);
        break;
      }

      case "play_again": {
        const lobby = getLobbyByPlayer(connectionId);
        if (!lobby) return sendError(ws, "You're not in a lobby");
        if (lobby.hostId !== connectionId) return sendError(ws, "Only the host can restart");
        if (lobby.phase !== "results") return sendError(ws, "The game is still running");
        resetToLobby(lobby);
        console.log(`[play_again] ${lobby.code}`);
        broadcastLobbyState(lobby);
        break;
      }
    }
  });

  ws.on("close", () => {
    console.log(`[disconnect] ${connectionId}`);
    const lobby = leaveLobby(connectionId);
    if (!lobby) return;
    if (lobby.phase === "lobby") {
      broadcastLobbyState(lobby);
    } else {
      recheckPhaseProgress(lobby);
    }
  });
});

console.log(`Bad Mental Canvas server listening on ws://0.0.0.0:${PORT}`);
advertiseOnLocalNetwork(PORT);
