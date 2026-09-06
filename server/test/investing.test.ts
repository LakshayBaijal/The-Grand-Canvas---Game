import { strict as assert } from "node:assert";
import test from "node:test";
import type { WebSocket } from "ws";

import {
  createFriendlyLobby,
  INVESTMENT_BUDGET,
  INVESTMENT_STEP,
  joinLobby,
  leaveLobby,
  recordDrawing,
  recordInvestment,
  type Member,
} from "../src/rooms.js";

/**
 * Money is the one number a client sends that ends up on a scoreboard, so it
 * is the one place a bad value has to be turned into a good one rather than
 * passed along. A NaN here used to survive every comparison and poison the
 * whole round's totals.
 */

const socket = () => ({}) as WebSocket;
let seq = 0;
const member = (nickname: string): Member => ({ playerId: `inv${++seq}`, ws: socket(), nickname });
const line = [{ color: "#1A1A1A", width: 5, points: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }] }];

/** Three seated players who have all drawn, so anyone can back anyone. */
function table() {
  const a = member("A");
  const b = member("B");
  const c = member("C");
  const lobby = createFriendlyLobby(a);
  joinLobby(lobby.code, b);
  joinLobby(lobby.code, c);
  for (const m of [a, b, c]) recordDrawing(lobby, m.playerId, "t", line);
  return { lobby, a, b, c, done: () => [a, b, c].forEach((m) => leaveLobby(m.playerId)) };
}

const raw = (o: Record<string, unknown>) => o as unknown as Record<string, number>;

test("anything that is not a finite number is nothing, not NaN", () => {
  const { lobby, a, b, c, done } = table();
  try {
    recordInvestment(lobby, a.playerId, raw({ [b.playerId]: NaN, [c.playerId]: "600" }));
    assert.deepEqual([...lobby.investments.get(a.playerId)!.entries()], []);

    recordInvestment(lobby, a.playerId, raw({ [b.playerId]: Infinity, [c.playerId]: null }));
    assert.deepEqual([...lobby.investments.get(a.playerId)!.entries()], []);

    // The player still counts as having voted — an all-junk ballot is an
    // empty one, and the round must be able to move past it.
    assert.equal(lobby.investments.has(a.playerId), true);
  } finally {
    done();
  }
});

test("amounts snap down to the step the buttons move by", () => {
  const { lobby, a, b, c, done } = table();
  try {
    recordInvestment(lobby, a.playerId, { [b.playerId]: INVESTMENT_STEP * 4 - 1, [c.playerId]: INVESTMENT_STEP - 1 });
    const mine = lobby.investments.get(a.playerId)!;
    assert.equal(mine.get(b.playerId), INVESTMENT_STEP * 3);
    assert.equal(mine.has(c.playerId), false, "less than one step is no investment");
  } finally {
    done();
  }
});

test("the budget holds, and self and strangers are ignored", () => {
  const { lobby, a, b, c, done } = table();
  try {
    recordInvestment(lobby, a.playerId, { [b.playerId]: INVESTMENT_BUDGET, [c.playerId]: INVESTMENT_STEP });
    const mine = lobby.investments.get(a.playerId)!;
    assert.equal(mine.get(b.playerId), INVESTMENT_BUDGET);
    assert.equal(mine.has(c.playerId), false, "nothing left after the budget");

    recordInvestment(lobby, a.playerId, { [a.playerId]: 1000, ghost: 400 });
    assert.deepEqual([...lobby.investments.get(a.playerId)!.entries()], []);
  } finally {
    done();
  }
});
