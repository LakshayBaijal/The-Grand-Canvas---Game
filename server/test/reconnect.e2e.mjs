/**
 * The disconnect-and-come-back path, end to end, against a real server.
 *
 *   PORT=8099 DB_PATH=/tmp/x.db npm run dev     # in one terminal
 *   node test/reconnect.e2e.mjs 8099            # in another
 *
 * Or let run-reconnect-e2e.sh start and stop the server for you.
 *
 * A player starts a game, their socket dies mid-phase, and a new socket
 * says hello with the same id. The server should hand back the seat and the
 * exact phase the table is on, with `isWriter` right for *this* player --
 * which is the whole point of the change, and the part a unit test can't
 * reach because it lives in the socket handlers.
 */
import WebSocket from "ws";

const PORT = process.argv[2] ?? "8099";
const URL = `ws://127.0.0.1:${PORT}`;
let checks = 0, fails = 0;
const check = (ok, label) => { checks++; console.log((ok ? "  ✓ " : "  ✗ ") + label); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Client {
  constructor(playerId, nickname) { this.playerId = playerId; this.nickname = nickname; this.events = []; this.waiters = []; }
  connect() {
    return new Promise((resolve) => {
      this.ws = new WebSocket(URL);
      this.ws.on("message", (raw) => {
        const m = JSON.parse(raw.toString());
        this.events.push(m);
        for (let i = this.waiters.length - 1; i >= 0; i--) {
          if (this.waiters[i].match(m)) { this.waiters[i].resolve(m); this.waiters.splice(i, 1); }
        }
      });
      this.ws.on("open", resolve);
    });
  }
  send(m) { this.ws.send(JSON.stringify(m)); }
  hello() { this.send({ type: "hello", playerId: this.playerId, nickname: this.nickname }); return this.wait((m) => m.type === "profile"); }
  wait(match, ms = 15000) {
    const found = this.events.find(match);
    if (found) return Promise.resolve(found);
    return new Promise((resolve, reject) => {
      const w = { match, resolve }; this.waiters.push(w);
      setTimeout(() => { if (this.waiters.includes(w)) reject(new Error("timed out waiting")); }, ms);
    });
  }
  /** The phone's network vanishing: no close frame, the TCP stream just ends. */
  vanish() { this.ws.terminate(); }
}

async function main() {
  console.log("\n== a seat survives a dropped socket ==");
  const host = new Client("e2e-recon-host", "Host");
  await host.connect(); await host.hello();
  host.send({ type: "create_lobby" });
  const lobby = await host.wait((m) => m.type === "lobby_state");
  host.send({ type: "add_bot" });
  await host.wait((m) => m.type === "lobby_state" && m.players.length === 2);
  host.send({ type: "start_game" });
  const writing = await host.wait((m) => m.type === "prompt_writing");
  check(writing.roundIndex === 0, "the game is on round 0, prompt_writing");
  const wasWriter = writing.isWriter;

  // The connection dies. No goodbye, no leave_lobby -- just gone.
  host.vanish();
  await sleep(600);

  // Same person, new socket, same id.
  const back = new Client("e2e-recon-host", "Host");
  await back.connect();
  await back.hello();
  const seated = await back.wait((m) => m.type === "lobby_state", 5000).catch(() => null);
  check(!!seated, "lobby_state arrives unasked: the seat was held and given back");
  check(seated?.code === lobby.code, `and it is the same room (${lobby.code})`);
  check(seated?.players.length === 2, "with everyone still at the table");

  const resumed = await back.wait((m) => m.type === "prompt_writing", 5000).catch(() => null);
  check(!!resumed, "the current phase is replayed, so the screen lands where the game is");
  check(resumed?.roundIndex === 0, "on the same round");
  check(resumed?.isWriter === wasWriter, `isWriter patched for this player (${wasWriter})`);
  check(resumed?.deadlineMs === writing.deadlineMs, "with the original deadline, so the clock is right");

  // And the game keeps working for the returned player.
  if (wasWriter) {
    back.send({ type: "submit_prompt", text: "the printer" });
    const round = await back.wait((m) => m.type === "round_start", 5000).catch(() => null);
    check(!!round, "the returned player can act: their prompt starts the round");
  }

  console.log("\n== a late close from the old socket does not evict them ==");
  // The zombie: reconnect on socket C while B is still open, then B closes.
  const zombie = back;
  const newest = new Client("e2e-recon-host", "Host");
  await newest.connect(); await newest.hello();
  await newest.wait((m) => m.type === "lobby_state", 5000);
  zombie.ws.close();                    // a clean close from the superseded socket
  await sleep(600);
  newest.send({ type: "ping" });
  await newest.wait((m) => m.type === "pong", 3000);
  // If the zombie's close had evicted us, the next lobby action would fail.
  newest.send({ type: "leave_lobby" });
  await sleep(300);
  newest.send({ type: "create_lobby" });
  const fresh = await newest.wait((m) => m.type === "lobby_state" && m.code !== lobby.code, 5000).catch(() => null);
  check(!!fresh, "still seated after the zombie closed; leaving and re-creating works");

  console.log(`\n${checks - fails}/${checks} checks passed`);
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.log("\nERROR:", e.message); process.exit(1); });
