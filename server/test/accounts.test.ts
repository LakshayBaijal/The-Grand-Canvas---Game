import { strict as assert } from "node:assert";
import test, { after, before } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as store from "../src/store.js";

/**
 * Linking a Google account decides what happens to somebody's trophies, so
 * the merge rules are pinned down here rather than left to be discovered by a
 * player who loses a career total.
 */

let dir: string;

before(() => {
  dir = mkdtempSync(join(tmpdir(), "canvas-store-"));
  store.openStore(join(dir, "test.db"));
});

after(() => {
  store.closeStore();
  rmSync(dir, { recursive: true, force: true });
});

let seq = 0;
const newPlayer = (nickname: string) => {
  const id = `device-${++seq}`;
  store.upsertPlayer(id, nickname);
  return id;
};

/** Gives a profile some career history to merge. */
function award(id: string, trophies: number, wins: number, best: number) {
  store.recordRankedResult(id, { trophies, won: wins > 0, score: best, rating: 1000 });
}

test("a fresh profile is not linked to anything", () => {
  const id = newPlayer("Solo");
  assert.equal(store.getProfile(id)!.linked, false);
});

test("linking an unused account just claims the current profile", () => {
  const id = newPlayer("First");
  award(id, 30, 1, 500);

  const profile = store.linkGoogle(id, "google-aaa");

  assert.equal(profile.id, id, "nothing should move when the account is new");
  assert.equal(profile.linked, true);
  assert.equal(profile.trophies, 30, "trophies must survive linking");
});

test("linking the same account twice is a no-op", () => {
  const id = newPlayer("Twice");
  store.linkGoogle(id, "google-bbb");
  const again = store.linkGoogle(id, "google-bbb");

  assert.equal(again.id, id);
  assert.equal(again.linked, true);
});

test("signing in on a new device moves the player onto the real account", () => {
  const oldPhone = newPlayer("Owner");
  award(oldPhone, 100, 1, 900);
  store.linkGoogle(oldPhone, "google-ccc");

  // A new phone: fresh device id, no history at all.
  const newPhone = newPlayer("Owner");
  const profile = store.linkGoogle(newPhone, "google-ccc");

  assert.equal(profile.id, oldPhone, "the account that exists everywhere wins");
  assert.equal(profile.trophies, 100, "this is the whole point of linking");
  assert.equal(
    store.getProfile(newPhone),
    null,
    "the throwaway device profile should not linger to be merged twice",
  );
});

test("games played before signing in are folded in, but rating is not", () => {
  const account = newPlayer("Veteran");
  award(account, 60, 1, 800);
  store.linkGoogle(account, "google-ddd");
  const before = store.getProfile(account)!;

  // Someone who played a few games on a new phone before signing in.
  const device = newPlayer("Veteran");
  award(device, 25, 1, 950);
  const deviceRating = store.getProfile(device)!.rating;

  const merged = store.linkGoogle(device, "google-ddd");

  assert.equal(merged.id, account);
  assert.equal(merged.trophies, before.trophies + 25, "career totals add up");
  assert.equal(merged.wins, before.wins + 1);
  assert.equal(merged.bestScore, 950, "a better score is still your best score");
  assert.ok(
    merged.rating <= Math.max(before.rating, deviceRating),
    "rating measures current skill; summing two would hand out free ladder "
      + "position for reinstalling the app",
  );
});

test("unlinking leaves the profile and its trophies alone", () => {
  const id = newPlayer("Leaver");
  award(id, 45, 1, 700);
  store.linkGoogle(id, "google-eee");

  const after = store.unlinkGoogle(id)!;

  assert.equal(after.linked, false);
  assert.equal(after.trophies, 45, "signing out is not a punishment");
  // And the account is free to be linked to something else afterwards.
  const other = newPlayer("Other");
  assert.equal(store.linkGoogle(other, "google-eee").id, other);
});

test("two different accounts never collide on one profile", () => {
  const a = newPlayer("A");
  const b = newPlayer("B");
  store.linkGoogle(a, "google-fff");
  store.linkGoogle(b, "google-ggg");

  assert.equal(store.getProfileByGoogle("google-fff")!.id, a);
  assert.equal(store.getProfileByGoogle("google-ggg")!.id, b);
});

/**
 * The thank-you is a reward for playing, deliberately NOT a reward for
 * rating: Google Play bans incentivised reviews outright, and the in-app
 * review API tells the app nothing about whether anyone rated, so there is
 * nothing to gate on even if it were allowed. What these pin down is the only
 * promise the server makes — it is owed after enough games, and offered once.
 */
test("the thank-you is owed only after enough games, and only once", () => {
  const id = newPlayer("Regular");
  assert.equal(store.getProfile(id)?.thanksDue, false, "not on day one");

  for (let i = 1; i < store.THANKS_AFTER_GAMES; i++) {
    award(id, 5, 0, 100);
    assert.equal(store.getProfile(id)?.thanksDue, false, `still not after ${i} games`);
  }

  award(id, 5, 1, 200);
  assert.equal(store.getProfile(id)?.thanksDue, true, "owed once the games are in");

  store.markThanked(id);
  assert.equal(store.getProfile(id)?.thanksDue, false, "and never owed again");

  // Playing on doesn't bring it back, and marking twice is harmless.
  award(id, 5, 0, 100);
  store.markThanked(id);
  assert.equal(store.getProfile(id)?.thanksDue, false);
});

test("signing in doesn't hand the thank-you out a second time", () => {
  // Played on the phone, was thanked, then signs in to an account that has
  // never been thanked. The folded-in games push the account past the
  // threshold; without carrying the flag across, the reward comes twice.
  const phone = newPlayer("Phone");
  for (let i = 0; i < store.THANKS_AFTER_GAMES; i++) award(phone, 5, 0, 100);
  store.markThanked(phone);

  const account = newPlayer("Account");
  store.linkGoogle(account, "google-thanks-a");
  assert.equal(store.getProfile(account)?.thanksDue, false, "no games yet");

  const merged = store.linkGoogle(phone, "google-thanks-a");
  assert.ok(merged.games >= store.THANKS_AFTER_GAMES, "the games really did fold in");
  assert.equal(merged.thanksDue, false, "already thanked on the phone — not again");
});

test("an untouched account still gets thanked after a merge", () => {
  const phone = newPlayer("Phone2");
  for (let i = 0; i < store.THANKS_AFTER_GAMES; i++) award(phone, 5, 0, 100);

  const account = newPlayer("Account2");
  store.linkGoogle(account, "google-thanks-b");

  const merged = store.linkGoogle(phone, "google-thanks-b");
  assert.equal(merged.thanksDue, true, "nobody has been thanked yet, so it is still owed");
});
