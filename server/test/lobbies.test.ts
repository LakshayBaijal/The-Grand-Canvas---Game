import { strict as assert } from "node:assert";
import test from "node:test";
import type { WebSocket } from "ws";

import {
  addBot,
  createFriendlyLobby,
  createRankedLobby,
  getLobbyByPlayer,
  joinLobby,
  kickPlayer,
  leaveLobby,
  openLobbies,
  setVisibility,
  FRIENDLY_MAX_PLAYERS,
  INVEST_SECONDS,
  voteSecondsFor,
  type Member,
} from "../src/rooms.js";

/** Lobbies only ever touch `ws` to send on it, which none of this exercises. */
const socket = () => ({}) as WebSocket;

let seq = 0;
function member(nickname: string): Member {
  return { playerId: `p${++seq}`, ws: socket(), nickname };
}

test("a new friendly room is listed for everyone by default", () => {
  const host = member("Lakshay");
  const lobby = createFriendlyLobby(host);

  const listed = openLobbies().find((l) => l.code === lobby.code);
  assert.ok(listed, "a room nobody can find is the problem the browser solves");
  assert.equal(listed.hostName, "Lakshay");
  assert.equal(listed.players, 1);
  assert.equal(listed.bots, 0);

  leaveLobby(host.playerId);
});

test("a code-only room is hidden but still joinable by code", () => {
  const host = member("Host");
  const lobby = createFriendlyLobby(host, "private");

  assert.equal(
    openLobbies().find((l) => l.code === lobby.code),
    undefined,
    "a private room must not appear in the browser",
  );

  // The whole point: hiding a room does not revoke codes already shared.
  const friend = member("Friend");
  const joined = joinLobby(lobby.code, friend);
  assert.equal(joined.code, lobby.code);

  leaveLobby(host.playerId);
  leaveLobby(friend.playerId);
});

test("ranked lobbies are never listed", () => {
  const a = member("A");
  const b = member("B");
  const lobby = createRankedLobby([a, b]);

  assert.equal(
    openLobbies().find((l) => l.code === lobby.code),
    undefined,
    "matchmade games are built complete and must never be gate-crashed",
  );

  leaveLobby(a.playerId);
  leaveLobby(b.playerId);
});

test("a full room drops out of the list", () => {
  const host = member("Host");
  const lobby = createFriendlyLobby(host);
  const joiners: Member[] = [];

  while (lobby.players.size < FRIENDLY_MAX_PLAYERS) {
    const m = member(`P${lobby.players.size}`);
    joinLobby(lobby.code, m);
    joiners.push(m);
  }

  assert.equal(
    openLobbies().find((l) => l.code === lobby.code),
    undefined,
    "offering a join that would then be refused is worse than not listing it",
  );

  // A seat opening up puts it back.
  leaveLobby(joiners[0].playerId);
  assert.ok(openLobbies().find((l) => l.code === lobby.code));

  leaveLobby(host.playerId);
  for (const m of joiners.slice(1)) leaveLobby(m.playerId);
});

test("bots are counted separately so nobody joins expecting humans", () => {
  const host = member("Host");
  const lobby = createFriendlyLobby(host);
  addBot(lobby);
  addBot(lobby);

  const listed = openLobbies().find((l) => l.code === lobby.code);
  assert.ok(listed);
  assert.equal(listed.players, 3);
  assert.equal(listed.bots, 2, "'3 playing' would be a lie with two bots in it");

  leaveLobby(host.playerId);
});

test("visibility can be flipped both ways while still in the lobby", () => {
  const host = member("Host");
  const lobby = createFriendlyLobby(host);

  assert.equal(setVisibility(lobby, "private"), true);
  assert.equal(openLobbies().find((l) => l.code === lobby.code), undefined);

  assert.equal(setVisibility(lobby, "public"), true);
  assert.ok(openLobbies().find((l) => l.code === lobby.code));

  leaveLobby(host.playerId);
});

test("a started game is neither listed nor joinable", () => {
  const host = member("Host");
  const lobby = createFriendlyLobby(host);
  lobby.phase = "drawing";

  assert.equal(openLobbies().find((l) => l.code === lobby.code), undefined);
  assert.throws(() => joinLobby(lobby.code, member("Late")), /already started/);
  // And the host cannot re-list it mid-game.
  assert.equal(setVisibility(lobby, "public"), false);

  leaveLobby(host.playerId);
});

test("the list is freshest first", () => {
  const older = member("Older");
  const a = createFriendlyLobby(older);
  a.createdAtMs = Date.now() - 60_000;

  const newer = member("Newer");
  const b = createFriendlyLobby(newer);

  const codes = openLobbies().map((l) => l.code);
  assert.ok(
    codes.indexOf(b.code) < codes.indexOf(a.code),
    "a room open for ten minutes is usually someone who wandered off",
  );

  leaveLobby(older.playerId);
  leaveLobby(newer.playerId);
});

test("the host can empty any seat, and the seat is genuinely free again", () => {
  const host = member("Host");
  const lobby = createFriendlyLobby(host);
  const guest = member("Guest");
  joinLobby(lobby.code, guest);
  addBot(lobby);
  assert.equal(lobby.players.size, 3);

  const removed = kickPlayer(lobby, guest.playerId);
  assert.equal(removed?.nickname, "Guest");
  assert.equal(lobby.players.size, 2);
  assert.equal(
    getLobbyByPlayer(guest.playerId),
    undefined,
    "a removed player must not still count as seated, or they can't join anywhere else",
  );

  // Bots go through the same door, so one control empties any seat.
  const bot = Array.from(lobby.players.values()).find((p) => p.isBot);
  assert.ok(bot);
  assert.ok(kickPlayer(lobby, bot.id));
  assert.equal(lobby.players.size, 1);

  assert.equal(kickPlayer(lobby, guest.playerId), null, "removing twice is not an error");

  leaveLobby(host.playerId);
});

test("a removed player can rejoin, and the room did not lose its seats", () => {
  const host = member("Host");
  const lobby = createFriendlyLobby(host);
  const guest = member("Guest");
  joinLobby(lobby.code, guest);

  kickPlayer(lobby, guest.playerId);
  // Nothing about a kick bans anyone — the host can just kick again. A ban
  // list is a much bigger promise than "not right now".
  const back = joinLobby(lobby.code, guest);
  assert.equal(back.code, lobby.code);
  assert.equal(lobby.players.size, 2);

  leaveLobby(host.playerId);
  leaveLobby(guest.playerId);
});

test("a friendly room seats ten and says so when it is full", () => {
  const host = member("Host");
  const lobby = createFriendlyLobby(host);
  for (let i = 1; i < FRIENDLY_MAX_PLAYERS; i++) joinLobby(lobby.code, member(`G${i}`));
  assert.equal(lobby.players.size, FRIENDLY_MAX_PLAYERS);

  assert.throws(() => joinLobby(lobby.code, member("Eleven")), /full/);

  // And a kick has to actually reopen the seat, not just hide someone.
  const victim = Array.from(lobby.players.values()).find((p) => p.id !== host.playerId);
  assert.ok(victim);
  kickPlayer(lobby, victim.id);
  const late = member("Eleven");
  assert.equal(joinLobby(lobby.code, late).code, lobby.code);

  for (const p of Array.from(lobby.players.keys())) leaveLobby(p);
});

test("the voting clock grows with the table, but not proportionally", () => {
  // A five-seat table is the baseline the number was tuned on.
  assert.equal(voteSecondsFor(5), INVEST_SECONDS);
  assert.equal(voteSecondsFor(2), INVEST_SECONDS, "small tables don't get less");

  const ten = voteSecondsFor(FRIENDLY_MAX_PLAYERS);
  assert.ok(ten > INVEST_SECONDS, "nine drawings need longer than four");
  assert.ok(
    ten < INVEST_SECONDS * 2,
    "twice the drawings must not mean twice the wait — a round that drags is worse",
  );
});
