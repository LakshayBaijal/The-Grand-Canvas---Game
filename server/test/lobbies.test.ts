import { strict as assert } from "node:assert";
import test from "node:test";
import type { WebSocket } from "ws";

import {
  addBot,
  createFriendlyLobby,
  createRankedLobby,
  joinLobby,
  leaveLobby,
  openLobbies,
  setVisibility,
  FRIENDLY_MAX_PLAYERS,
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
