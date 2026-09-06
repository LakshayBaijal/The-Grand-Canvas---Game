import { strict as assert } from "node:assert";
import test from "node:test";
import type { WebSocket } from "ws";

import {
  createFriendlyLobby,
  leaveLobby,
  stalledLobbies,
  type Member,
} from "../src/rooms.js";

/**
 * The watchdog only gets to act on what this reports, so what matters is that
 * it reports a genuinely stuck game and nothing else: not a game that is
 * merely a little late, not one that hasn't started, not one that is over.
 */

const socket = () => ({}) as WebSocket;
let seq = 0;
const member = (nickname: string): Member => ({ playerId: `stall${++seq}`, ws: socket(), nickname });

test("a game well past its deadline is reported; a slightly late one is not", () => {
  const host = member("H");
  const lobby = createFriendlyLobby(host);
  try {
    const now = 1_000_000_000;
    lobby.phase = "reveal";

    lobby.deadlineMs = now - 5_000; // the timer's own grace is 1.5s; this is late, not lost
    assert.equal(stalledLobbies(now, 30_000).includes(lobby), false);

    lobby.deadlineMs = now - 60_000;
    assert.equal(stalledLobbies(now, 30_000).includes(lobby), true);
  } finally {
    leaveLobby(host.playerId);
  }
});

test("waiting rooms and finished games are never 'stuck'", () => {
  const host = member("H");
  const lobby = createFriendlyLobby(host);
  try {
    const now = 1_000_000_000;
    lobby.deadlineMs = now - 600_000;

    lobby.phase = "lobby";
    assert.equal(stalledLobbies(now, 30_000).includes(lobby), false, "a lobby has no clock to miss");

    lobby.phase = "results";
    assert.equal(stalledLobbies(now, 30_000).includes(lobby), false, "results is where a game rests");

    // A timed phase that has never been given a deadline is not overdue.
    lobby.phase = "drawing";
    lobby.deadlineMs = 0;
    assert.equal(stalledLobbies(now, 30_000).includes(lobby), false);
  } finally {
    leaveLobby(host.playerId);
  }
});
