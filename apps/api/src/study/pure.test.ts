import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { describe, it } from "node:test";
import { BLOCK_SIZE, type Condition, nextInBlock, stageOf, susScore, toCsv } from "./pure.js";

describe("nextInBlock", () => {
  it("only offers the condition still missing from the block", () => {
    assert.equal(nextInBlock(["personalised", "personalised"], () => 0), "fixed");
    assert.equal(nextInBlock(["fixed", "personalised", "fixed"], () => 0), "personalised");
  });

  it("draws in proportion to the slots left", () => {
    // one personalised slot and two fixed slots left: rand 0 -> personalised, 1 or 2 -> fixed
    const block: Condition[] = ["personalised"];
    assert.equal(nextInBlock(block, () => 0), "personalised");
    assert.equal(nextInBlock(block, () => 1), "fixed");
    assert.equal(nextInBlock(block, () => 2), "fixed");
  });

  it("keeps every full block balanced with real randomness", () => {
    let all: Condition[] = [];
    for (let i = 0; i < 400; i++) {
      const inBlock = all.slice(all.length - (all.length % BLOCK_SIZE));
      all = [...all, nextInBlock(inBlock, randomInt)];
    }
    for (let b = 0; b < all.length; b += BLOCK_SIZE) {
      const block = all.slice(b, b + BLOCK_SIZE);
      assert.equal(block.filter((c) => c === "personalised").length, BLOCK_SIZE / 2);
    }
  });

  it("gives the other condition when forced sign-ups overfilled a block", () => {
    assert.equal(nextInBlock(["fixed", "fixed", "fixed"], () => 1), "personalised");
    assert.equal(nextInBlock(["personalised", "personalised", "personalised"], () => 0), "fixed");
  });
});

describe("susScore", () => {
  it("scores the best possible answers as 100 and the worst as 0", () => {
    assert.equal(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 1]), 100);
    assert.equal(susScore([1, 5, 1, 5, 1, 5, 1, 5, 1, 5]), 0);
  });

  it("scores all-neutral answers as 50", () => {
    assert.equal(susScore([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]), 50);
  });

  it("rejects incomplete or out-of-range responses", () => {
    assert.throws(() => susScore([3, 3, 3]));
    assert.throws(() => susScore([3, 3, 3, 3, 3, 3, 3, 3, 3, 6]));
  });
});

describe("toCsv", () => {
  it("quotes only where needed and leaves nulls empty", () => {
    const csv = toCsv(["a", "b", "c"], [["x,y", 'say "hi"', null], [1, true, new Date("2026-01-02T03:04:05Z")]]);
    assert.equal(csv, 'a,b,c\r\n"x,y","say ""hi""",\r\n1,true,2026-01-02T03:04:05.000Z\r\n');
  });
});

describe("stageOf", () => {
  const s = (preDone: boolean, practiceDone: boolean, postDone: boolean, susDone: boolean) =>
    stageOf({ preDone, practiceDone, postDone, susDone });

  it("follows pre-test, practice, post-test, survey", () => {
    assert.equal(s(false, false, false, false), "pre_test");
    assert.equal(s(true, false, false, false), "practice");
    assert.equal(s(true, true, false, false), "post_test");
    assert.equal(s(true, true, true, false), "survey");
    assert.equal(s(true, true, true, true), "finished");
  });

  it("requires the pre-test before anything else", () => {
    assert.equal(s(false, true, true, true), "pre_test");
  });
});
