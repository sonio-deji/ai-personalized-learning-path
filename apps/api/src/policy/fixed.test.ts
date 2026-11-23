import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextFixedQuestion } from "./fixed.js";

const topics = [
  { id: "b", curriculumOrder: 2 },
  { id: "a", curriculumOrder: 1 },
];

const questions = [
  { id: "a-hard", topicId: "a", difficulty: 3 },
  { id: "a-easy", topicId: "a", difficulty: 1 },
  { id: "a-mid", topicId: "a", difficulty: 2 },
  { id: "b-2", topicId: "b", difficulty: 1 },
  { id: "b-1", topicId: "b", difficulty: 1 },
];

const next = (attempted: string[], perTopic = 2) =>
  nextFixedQuestion(topics, questions, new Set(attempted), perTopic)?.id ?? null;

describe("nextFixedQuestion", () => {
  it("starts with the easiest question of the first topic in curriculum order", () => {
    assert.equal(next([]), "a-easy");
  });

  it("moves through a topic by difficulty", () => {
    assert.equal(next(["a-easy"]), "a-mid");
  });

  it("moves to the next topic after perTopic questions", () => {
    assert.equal(next(["a-easy", "a-mid"]), "b-1");
  });

  it("breaks difficulty ties by id so the order is stable", () => {
    assert.equal(next(["a-easy", "a-mid", "b-1"]), "b-2");
  });

  it("returns null when every topic is finished", () => {
    assert.equal(next(["a-easy", "a-mid", "b-1", "b-2"]), null);
  });

  it("finishes a topic early when it has fewer than perTopic questions", () => {
    assert.equal(next(["a-easy", "a-mid", "a-hard"], 5), "b-1");
  });

  it("does not repeat a question attempted out of order", () => {
    assert.equal(next(["a-mid"]), "a-easy");
    assert.equal(next(["a-mid", "a-easy"]), "b-1");
  });

  it("skips topics with no questions", () => {
    const withEmpty = [{ id: "empty", curriculumOrder: 0 }, ...topics];
    assert.equal(nextFixedQuestion(withEmpty, questions, new Set(), 2)?.id, "a-easy");
  });
});
