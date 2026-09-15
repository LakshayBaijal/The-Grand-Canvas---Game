import { strict as assert } from "node:assert";
import test, { mock } from "node:test";
import type { WebSocket } from "ws";

import {
  createFriendlyLobby,
  getLobbyByPlayer,
  holdSeat,
  joinLobby,
  leaveLobby,
  ownsSeat,
  reclaimSeat,
  type Member,
} from "../src/rooms.js";

/**
 * What happens to a seat when its socket drops. The old behaviour was
 * "you're gone", instantly, on the first dropped packet -- which on a phone
 * meant a locked screen or a walk out of Wi-Fi range ended your game with no
 * way back in. These pin the replacement: the seat is held, the same person
 * can reclaim it, and only if they don't come back does anyone leave.
 */

let seq = 0;
const socket = () => ({ tag: ++seq }) as unknown as WebSocket;
const member = (nickname: string, ws = socket()): Member => ({ playerId: `p${++seq}`, ws, nickname });

test("a dropped socket holds the seat rather than giving it up", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const host = member("Host");
  const lobby = createFriendlyLobby(host);
  const guest = member("Guest");
  joinLobby(lobby.code, guest);

  let expired = false;
  assert.ok(holdSeat(lobby, guest.playerId, 5000, () => { expired = true; }));

  assert.equal(lobby.players.size, 2, "the seat is still taken");
  assert.equal(lobby.players.get(guest.playerId)!.ws, null, "but the dead socket is gone");
  assert.equal(getLobbyByPlayer(guest.playerId), lobby, "and they still count as seated");
  assert.equal(expired, false);

  mock.timers.tick(4999);
  assert.equal(expired, false, "not a moment early");
  mock.timers.tick(1);
  assert.equal(expired, true, "the hold runs out on time");

  mock.timers.reset();
  leaveLobby(host.playerId); leaveLobby(guest.playerId);
});

test("coming back in time reclaims the seat and cancels the hold", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const host = member("Host");
  const lobby = createFriendlyLobby(host);
  const guest = member("Guest");
  joinLobby(lobby.code, guest);

  let expired = false;
  holdSeat(lobby, guest.playerId, 5000, () => { expired = true; });
  mock.timers.tick(3000);

  const fresh = socket();
  assert.ok(reclaimSeat(lobby, guest.playerId, fresh));
  assert.equal(lobby.players.get(guest.playerId)!.ws, fresh, "seated on the new socket");
  assert.equal(lobby.players.get(guest.playerId)!.graceTimer, null, "the clock is stopped");

  mock.timers.tick(10_000);
  assert.equal(expired, false, "a cancelled hold must never fire -- that would evict someone who is present");

  mock.timers.reset();
  leaveLobby(host.playerId); leaveLobby(guest.playerId);
});

test("an old socket closing late cannot evict the person who already came back", () => {
  // The zombie case: the phone reconnects on socket B while socket A is still
  // technically open, then A finally closes. A no longer owns the seat, so
  // the close handler must do nothing -- ownsSeat is what it checks.
  const host = member("Host");
  const lobby = createFriendlyLobby(host);
  const old = socket();
  const guest = member("Guest", old);
  joinLobby(lobby.code, guest);

  const fresh = socket();
  reclaimSeat(lobby, guest.playerId, fresh);

  assert.equal(ownsSeat(lobby, guest.playerId, old), false, "the old socket is a stranger now");
  assert.equal(ownsSeat(lobby, guest.playerId, fresh), true);

  leaveLobby(host.playerId); leaveLobby(guest.playerId);
});

test("bots can't be held or reclaimed, and neither can strangers", () => {
  const host = member("Host");
  const lobby = createFriendlyLobby(host);
  assert.equal(holdSeat(lobby, "nobody", 1000, () => {}), false);
  assert.equal(reclaimSeat(lobby, "nobody", socket()), false);
  leaveLobby(host.playerId);
});

test("leaving for real while held stops the clock", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const host = member("Host");
  const lobby = createFriendlyLobby(host);
  const guest = member("Guest");
  joinLobby(lobby.code, guest);

  let expired = false;
  holdSeat(lobby, guest.playerId, 5000, () => { expired = true; });
  leaveLobby(guest.playerId);            // e.g. the host kicked them meanwhile
  mock.timers.tick(10_000);
  assert.equal(expired, false, "a seat that was already given up must not be given up twice");

  mock.timers.reset();
  leaveLobby(host.playerId);
});
