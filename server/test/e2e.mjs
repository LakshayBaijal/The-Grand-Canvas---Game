/**
 * End-to-end check of both game modes against a running server.
 *
 *   npm run dev          # in one terminal
 *   npm run test:e2e     # in another
 *
 * Drives real WebSocket clients through a full ranked game and a full friendly
 * game. This is where the interesting behaviour lives — the phase state
 * machine, matchmaking, trophy maths and the leaderboard — none of which unit
 * tests reach.
 *
 * It takes a few minutes on purpose: bots deliberately take most of the phase
 * clock to act, and the run waits them out rather than faking the timings.
 */
import { TROPHY_DELTAS } from "../src/ranking.ts";
import WebSocket from "ws";

const URL = process.env.E2E_URL ?? "ws://127.0.0.1:8090";

let checks = 0;
let fails = 0;
const check = (ok, label) => {
  checks++;
  if (ok) {
    console.log("  ✓", label);
  } else {
    fails++;
    console.log("  ✗", label);
  }
};

class Client {
  constructor(playerId, nickname) {
    this.playerId = playerId;
    this.nickname = nickname;
    this.events = [];
    this.waiters = [];
  }

  connect() {
    return new Promise((resolve) => {
      this.ws = new WebSocket(URL);
      this.ws.on("message", (raw) => {
        const message = JSON.parse(raw.toString());
        this.events.push(message);
        for (let i = this.waiters.length - 1; i >= 0; i--) {
          if (this.waiters[i].match(message)) {
            this.waiters[i].resolve(message);
            this.waiters.splice(i, 1);
          }
        }
      });
      this.ws.on("open", resolve);
    });
  }

  send(message) {
    this.ws.send(JSON.stringify(message));
  }

  hello() {
    this.send({ type: "hello", playerId: this.playerId, nickname: this.nickname });
    return this.wait((m) => m.type === "profile");
  }

  /** Matches against everything received so far, then waits for new arrivals —
   *  so a test never loses a race against a message that came in early. */
  wait(match, ms = 200000) {
    const found = this.events.find(match);
    if (found) return Promise.resolve(found);
    return new Promise((resolve, reject) => {
      const waiter = { match, resolve };
      this.waiters.push(waiter);
      setTimeout(() => {
        if (this.waiters.includes(waiter)) reject(new Error("timed out waiting for a message"));
      }, ms);
    });
  }

  /** History is matched against, so a second game would otherwise match the
   *  first game's round 0. */
  forget() {
    this.events = [];
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Plays one complete game to its final results. */
async function playGame(clients, scoring) {
  for (let round = 0; round < 20; round++) {
    const prompts = await Promise.all(
      clients.map((c) => c.wait((m) => m.type === "prompt_writing" && m.roundIndex === round)),
    );
    clients[prompts.findIndex((m) => m.isWriter)].send({
      type: "submit_prompt",
      text: "loud chewing",
    });

    await Promise.all(
      clients.map((c) => c.wait((m) => m.type === "round_start" && m.roundIndex === round)),
    );
    for (const c of clients) {
      c.send({
        type: "submit_drawing",
        title: `${c.nickname}'s thing`,
        strokes: [{ color: "#000000", width: 5, points: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }] }],
      });
    }

    const voting = await Promise.all(
      clients.map((c) => c.wait((m) => m.type === "voting_phase" && m.roundIndex === round)),
    );
    check(voting[0].scoring === scoring, `round ${round}: scoring is "${scoring}"`);

    clients.forEach((client, i) => {
      const others = voting[i].entries.filter((e) => e.artistId !== client.playerId);
      if (scoring === "money") {
        const allocations = {};
        const units = Math.floor(voting[i].budget / voting[i].step);
        const per = Math.floor(units / Math.max(others.length, 1)) * voting[i].step;
        let left = voting[i].budget;
        others.forEach((entry, k) => {
          const amount = k === others.length - 1 ? left : per;
          allocations[entry.artistId] = amount;
          left -= amount;
        });
        client.send({ type: "submit_investment", allocations });
      } else {
        client.send({
          type: "submit_ranking",
          order: others.slice(0, voting[i].places).map((e) => e.artistId),
        });
      }
    });

    await Promise.all(
      clients.map((c) => c.wait((m) => m.type === "round_reveal" && m.roundIndex === round)),
    );
    // The server holds on the last reveal before ending, so wait for whichever
    // comes next: another round, or the results.
    const next = await Promise.race([
      clients[0].wait((m) => m.type === "final_results"),
      clients[0].wait((m) => m.type === "prompt_writing" && m.roundIndex === round + 1),
    ]);
    if (next.type === "final_results") return next;
  }
  throw new Error("the game never finished");
}

async function main() {
  console.log("\n== identity persists ==");
  const alpha = new Client("e2e-device-aaa", "Alpha");
  await alpha.connect();
  const first = await alpha.hello();
  check(first.profile.id === "e2e-device-aaa", "profile is keyed by the device id");
  const startingTrophies = first.profile.trophies;
  const startingGames = first.profile.games;

  alpha.send({ type: "set_nickname", nickname: "Alpha2" });
  const renamed = await alpha.wait((m) => m.type === "profile" && m.profile.nickname === "Alpha2");
  check(renamed.profile.id === "e2e-device-aaa", "renaming keeps the same account");
  check(renamed.profile.trophies === startingTrophies, "renaming doesn't reset trophies");

  console.log("\n== ranked: queue, bot backfill, trophies ==");
  const beta = new Client("e2e-device-bbb", "Beta");
  await beta.connect();
  await beta.hello();
  alpha.send({ type: "find_match" });
  beta.send({ type: "find_match" });

  const status = await alpha.wait((m) => m.type === "queue_status");
  check(status.target === 5, `the queue targets 5 (${status.target})`);
  check(status.botFillAtMs > Date.now(), "a bot backfill is scheduled");

  const lobby = await alpha.wait((m) => m.type === "lobby_state");
  check(lobby.mode === "ranked", "the matchmade lobby is ranked");
  check(lobby.players.length === 5, `backfilled to 5 (${lobby.players.length})`);
  check(lobby.players.filter((p) => p.isBot).length === 3, "3 bots filled the empty seats");
  check(lobby.players.filter((p) => !p.isBot).length === 2, "both humans are in it");

  // Nobody pressed anything: ranked games start themselves after a short beat.
  const opening = await alpha.wait((m) => m.type === "prompt_writing");
  check(opening.roundIndex === 0, "the ranked game starts itself");

  const ranked = await playGame([alpha, beta], "money");
  check(ranked.mode === "ranked", "the final results say ranked");
  const awards = Object.values(ranked.trophies);
  check(Object.keys(ranked.trophies).length === 2, `only humans earn trophies (${awards.length})`);
  check(awards.every((t) => Number.isInteger(t)), "every human gets a trophy change (up or down)");
  check(Math.max(...awards) < TROPHY_DELTAS.bronze[0], "trophies scale down in a bot-heavy lobby");

  const updated = await alpha.wait(
    (m) => m.type === "profile" && m.profile.games === startingGames + 1,
  );
  check(
    updated.profile.trophies === Math.max(0, startingTrophies + ranked.trophies["e2e-device-aaa"]),
    "trophies are banked to the profile",
  );
  // A rank only exists once placement games are done (PLACEMENT_GAMES on the
  // server), so what has to hold is the relationship, whatever this device's
  // history on the server happens to be: no rank while placing, a rank after.
  check(updated.profile.seasonGames >= 1, "the game counted towards this season");
  check(
    (updated.profile.rank === null) === (updated.profile.placementsLeft > 0),
    `a rank appears exactly when placement ends (rank ${updated.profile.rank}, ` +
      `${updated.profile.placementsLeft} placements left)`,
  );

  console.log("\n== leaderboard ==");
  alpha.send({ type: "get_leaderboard" });
  const board = await alpha.wait((m) => m.type === "leaderboard");
  check(board.you?.id === "e2e-device-aaa", "your own profile comes back with it");
  // Only placed players are listed, so whether we are on it depends on how
  // many games this device has played on this server — but it must agree
  // with what the profile says.
  const listed = board.entries.some((e) => e.id === "e2e-device-aaa");
  check(
    listed === (board.you.placementsLeft === 0),
    `on the board exactly when placed (listed ${listed}, ${board.you.placementsLeft} placements left)`,
  );
  check(board.entries.every((e, i) => e.rank === i + 1), "ranks run 1, 2, 3… with no gaps");
  check(
    board.entries.every((e, i) => i === 0 || board.entries[i - 1].rating >= e.rating),
    "entries are sorted by rating",
  );
  check(!board.entries.some((e) => e.id.startsWith("bot-")), "bots never appear on it");
  const trophiesBeforeFriendly = board.you.trophies;

  alpha.send({ type: "leave_lobby" });
  beta.send({ type: "leave_lobby" });
  await sleep(400);

  console.log("\n== friendly: podium voting, no trophies ==");
  const gamma = new Client("e2e-device-ccc", "Gamma");
  await gamma.connect();
  await gamma.hello();

  alpha.send({ type: "create_lobby" });
  const created = await alpha.wait((m) => m.type === "lobby_state" && m.mode === "friendly");
  check(created.mode === "friendly", "the created lobby is friendly");

  gamma.send({ type: "join_lobby", code: created.code });
  await gamma.wait((m) => m.type === "lobby_state");
  alpha.send({ type: "add_bot" });
  const withBot = await alpha.wait((m) => m.type === "lobby_state" && m.players.length === 3);
  check(withBot.players.some((p) => p.isBot), "the host can add bots in friendly");

  alpha.forget();
  gamma.forget();
  alpha.send({ type: "start_game" });

  const friendly = await playGame([alpha, gamma], "points");
  check(friendly.mode === "friendly", "the final results say friendly");
  check(Object.keys(friendly.trophies).length === 0, "friendly games award no trophies");

  alpha.forget();
  alpha.send({ type: "get_leaderboard" });
  const after = await alpha.wait((m) => m.type === "leaderboard");
  check(
    after.you.trophies === trophiesBeforeFriendly,
    "the friendly game left the leaderboard untouched",
  );

  console.log(`\n${checks - fails}/${checks} checks passed`);
  process.exit(fails ? 1 : 0);
}

main().catch((err) => {
  console.log("\nERROR:", err.message);
  process.exit(1);
});
