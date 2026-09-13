import { strict as assert } from "node:assert";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as store from "../src/store.js";

/**
 * Friends are symmetric once accepted and one-sided until then. The whole
 * feature is those two facts plus "a request the other way is a yes".
 */
function freshStore(): string {
  const dir = mkdtempSync(join(tmpdir(), "grandcanvas-friends-"));
  store.openStore(join(dir, "test.db"));
  for (const [id, name] of [["a", "Asha"], ["b", "Bo"], ["c", "Cy"]]) store.upsertPlayer(id, name);
  return dir;
}

test("request, accept, and the list on both sides", () => {
  const dir = freshStore();
  try {
    assert.equal(store.requestFriend("a", "a"), "self");
    assert.equal(store.requestFriend("a", "nobody"), "unknown");
    assert.equal(store.requestFriend("a", "b"), "sent");
    assert.equal(store.requestFriend("a", "b"), "pending", "asking twice is still one request");

    let a = store.friendsOf("a"), b = store.friendsOf("b");
    assert.deepEqual(a.outgoing.map((f) => f.id), ["b"]);
    assert.deepEqual(b.incoming.map((f) => f.id), ["a"]);
    assert.equal(a.friends.length + b.friends.length, 0);
    assert.equal(store.areFriends("a", "b"), false);

    assert.equal(store.acceptFriend("c", "a"), false, "c can't accept a request that wasn't for c");
    assert.equal(store.acceptFriend("b", "a"), true);
    a = store.friendsOf("a"); b = store.friendsOf("b");
    assert.deepEqual(a.friends.map((f) => f.nickname), ["Bo"]);
    assert.deepEqual(b.friends.map((f) => f.nickname), ["Asha"]);
    assert.equal(a.outgoing.length + b.incoming.length, 0);
    assert.equal(store.areFriends("a", "b"), true);
    assert.equal(store.areFriends("b", "a"), true);
    assert.equal(store.requestFriend("a", "b"), "already");
  } finally {
    store.closeStore();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a request the other way is an acceptance; remove clears both directions", () => {
  const dir = freshStore();
  try {
    assert.equal(store.requestFriend("b", "c"), "sent");
    assert.equal(store.requestFriend("c", "b"), "accepted");
    assert.equal(store.areFriends("b", "c"), true);

    store.removeFriend("c", "b");
    assert.equal(store.areFriends("b", "c"), false);
    assert.equal(store.friendsOf("b").friends.length, 0);
    assert.equal(store.friendsOf("c").friends.length, 0);
    // Declining works the same way: the pending row goes.
    store.requestFriend("a", "c");
    store.removeFriend("c", "a");
    assert.equal(store.friendsOf("c").incoming.length, 0);
    assert.equal(store.friendsOf("a").outgoing.length, 0);
  } finally {
    store.closeStore();
    rmSync(dir, { recursive: true, force: true });
  }
});
