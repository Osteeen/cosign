import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { matchScore, minimumScore, queryWords, singular } from "./match.ts";

describe("product matching", () => {
  it("reduces plain plurals", () => {
    assert.equal(singular("notes"), "note");
    assert.equal(singular("pens"), "pen");
    assert.equal(singular("boxes"), "box");
    assert.equal(singular("glasses"), "glass");
    assert.equal(singular("class"), "class");
    assert.equal(singular("gas"), "gas");
  });

  it("drops filler words and short words", () => {
    assert.deepEqual(queryWords("Buy some sticky NOTES for the office"), ["sticky", "note"]);
    assert.deepEqual(queryWords("a 12 oz bag"), ["bag"]);
  });

  it("needs most of the query's words", () => {
    assert.equal(minimumScore(["sticky"]), 1);
    assert.equal(minimumScore(["black", "toner"]), 2);
    assert.equal(minimumScore(["copy", "paper", "case"]), 2);
    const wanted = queryWords("black toner");
    assert.equal(matchScore(wanted, "Black toner cartridge (fits LaserJet 58A)"), 2);
    assert.ok(matchScore(wanted, "Black tea, 100 bags") < minimumScore(wanted));
  });
});
