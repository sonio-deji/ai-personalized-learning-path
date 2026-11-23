import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MASTERY_THRESHOLD, nextPersonalisedQuestion } from "./personalised.js";

const topics = [
  { id: "b", curriculumOrder: 2 },
  { id: "a", curriculumOrder: 1 },
  { id: "c", curriculumOrder: 3 },
];

const questions = [
  { id: "a-2", topicId: "a", difficulty: 2 },
  { id: "a-1", topicId: "a", difficulty: 1 },
  { id: "b-1", topicId: "b", difficulty: 1 },
  { id: "b-2", topicId: "b", difficulty: 2 },
  { id: "c-1", topicId: "c", difficulty: 1 },
];

const next = (attempted: string[], m: Record<string, number>) =>
  nextPersonalisedQuestion(topics, questions, new Set(attempted), new Map(Object.entries(m)))?.id ?? null;

const low = { a: 0.3, b: 0.3, c: 0.3 };

describe("nextPersonalisedQuestion", () => {
  it("starts with the easiest question of the earliest unmastered topic", () => {
    assert.equal(next([], low), "a-1");
  });

  it("stays on a topic while it is not mastered", () => {
    assert.equal(next(["a-1"], { ...low, a: 0.8 }), "a-2");
  });

  it("skips a topic as soon as it is mastered", () => {
    assert.equal(next(["a-1"], { ...low, a: 0.97 }), "b-1");
  });

  it("skips topics mastered from the prior alone", () => {
    assert.equal(next([], { a: 0.99, b: 0.99, c: 0.3 }), "c-1");
  });

  it("treats exactly the threshold as mastered", () => {
    assert.equal(next([], { ...low, a: MASTERY_THRESHOLD }), "b-1");
  });

  it("moves on when an unmastered topic runs out of questions", () => {
    assert.equal(next(["a-1", "a-2"], { ...low, a: 0.5 }), "b-1");
  });

  it("returns null when every topic is mastered or exhausted", () => {
    assert.equal(next(["c-1"], { a: 0.96, b: 0.99, c: 0.4 }), null);
  });

  it("treats a topic missing from the mastery map as not mastered", () => {
    assert.equal(next([], {}), "a-1");
  });
});
