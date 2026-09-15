import { strict as assert } from "node:assert";
import test from "node:test";
import type { WebSocket } from "ws";

import {
  beginDrawingRound,
  createRankedLobby,
  createFriendlyLobby,
  quitPenalty,
  trophiesForGame,
  type Member,
} from "../src/rooms.js";
import { TROPHY_DELTAS } from "../src/ranking.js";

/**
 * Walking out of a ranked game is a loss, not an escape hatch. Before this,
 * a player watching a round go badly could quit and be rated on nothing,
 * leaving the other four to eat the result.
 */

let seq = 0;
const socket = () => ({ tag: ++seq }) as unknown as WebSocket;
const member = (nickname: string, trophies = 0): Member =>
  ({ playerId: `p${++seq}`, ws: socket(), nickname, trophies });

const ratingsOf = (ids: string[], rating = 1000) =>
  new Map(ids.map((id) => [id, { rating, gamesPlayed: 10 }]));

test("quitting a running ranked game is charged as last place", () => {
  const players = [member("A", 700), member("B"), member("C"), member("D"), member("E")];
  const lobby = createRankedLobby(players);
  beginDrawingRound(lobby);
  // A is winning on the board and leaves anyway.
  lobby.scores.set(players[0].playerId, 900);

  const penalty = quitPenalty(lobby, players[0].playerId, ratingsOf(players.map((p) => p.playerId)));
  assert.ok(penalty, "a human leaving a running ranked game is charged");
  assert.equal(penalty.trophies, TROPHY_DELTAS.silver[4], "last place in their own tier");
  assert.ok(penalty.rating.delta < 0, "and the rating goes down");
});

test("there is nothing to charge outside a running ranked game", () => {
  const players = [member("A"), member("B"), member("C")];
  const ranked = createRankedLobby(players);
  const ratings = ratingsOf(players.map((p) => p.playerId));
  assert.equal(quitPenalty(ranked, players[0].playerId, ratings), null, "still in the lobby");
  ranked.phase = "results";
  assert.equal(quitPenalty(ranked, players[0].playerId, ratings), null, "game is over");

  const friendly = createFriendlyLobby(member("Host"));
  beginDrawingRound(friendly);
  assert.equal(quitPenalty(friendly, friendly.hostId, ratings), null, "friendly games score nothing");
});

test("trophies go down for the bottom of a ranked table, by tier", () => {
  const players = [member("Gold", 1500), member("Bronze", 10), member("C"), member("D"), member("E")];
  const lobby = createRankedLobby(players);
  // Gold finishes last, Bronze first.
  lobby.scores.set(players[0].playerId, 0);
  lobby.scores.set(players[1].playerId, 2000);
  for (const p of players.slice(2)) lobby.scores.set(p.playerId, 1000);

  const awards = trophiesForGame(lobby);
  assert.equal(awards[players[1].playerId], TROPHY_DELTAS.bronze[0], "bronze winner gains the most");
  assert.equal(awards[players[0].playerId], TROPHY_DELTAS.gold[4], "gold in last loses the most");
});
