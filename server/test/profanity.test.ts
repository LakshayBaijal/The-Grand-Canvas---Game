import { strict as assert } from "node:assert";
import test from "node:test";

import { findProfanity, hasProfanity, maskProfanity } from "../src/profanity.js";

/**
 * A word filter fails in two directions, and the second is the one people
 * actually notice: banning "Scunthorpe". So half of this is a list of
 * innocent text that must pass, and it is the half worth growing whenever a
 * real answer gets caught by mistake.
 */

test("the obvious cases are caught", () => {
  for (const s of [
    "Dick Died",
    "dick died",
    "a giant DICK",
    "fuck this",
    "what the fuuuuck",
    "f u c k",
    "sh1t happens",
    "bull$hit",
    "you absolute wanker",
    "chutiya boss",
    "madarchod",
    "bhen chod",
    "gaand mara",
    "m0therfucker",
  ]) {
    assert.ok(hasProfanity(s), `should be caught: ${JSON.stringify(s)}`);
  }
});

test("innocent words that contain rude ones are left alone", () => {
  for (const s of [
    "Charles Dickens",
    "Scunthorpe United",
    "an assistant manager",
    "the cockerel crowed",
    "a classic situation",
    "shitake mushrooms", // common misspelling of shiitake, and not rude
    "grape juice",
    "basement",
    "cumbersome luggage",
    "hell of a day",
    "the analyst",
    "passing traffic",
    "my sister's cassette",
    "Mass Effect",
    "Bombay duck",
    "Salman Khan",
    "Chandigarh",
    "landlord",
    "Cocker spaniel",
    "loud chewing",
    "cold showers",
  ]) {
    assert.equal(findProfanity(s), null, `false positive on ${JSON.stringify(s)}`);
  }
});

test("masking keeps the shape of the sentence and only hides the word", () => {
  assert.equal(maskProfanity("The Dick Died 3000"), "The **** Died 3000");
  assert.equal(maskProfanity("Fuuuck-o-matic"), "******-o-matic");
  assert.equal(maskProfanity("A perfectly nice title"), "A perfectly nice title");
  assert.equal(maskProfanity("sh1thead machine"), "******** machine");
  assert.ok(!hasProfanity(maskProfanity("what the fuck, chutiya")));
});

test("empty and odd input is safe", () => {
  assert.equal(findProfanity(""), null);
  assert.equal(findProfanity("   "), null);
  assert.equal(findProfanity("!!!???"), null);
  assert.equal(maskProfanity(""), "");
});
