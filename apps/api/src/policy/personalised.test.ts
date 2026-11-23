import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_MIN_ANSWERS, MASTERY_THRESHOLD, nextPersonalisedQuestion } from "./personalised.js";

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

// minAnswers 0 isolates the threshold logic; the minimum-answers rule has its own tests below.
const next = (attempted: string[], m: Record<string, number>, minAnswers = 0) =>
  nextPersonalisedQuestion(topics, questions, new Set(attempted), new Map(Object.entries(m)), { minAnswers })
    ?.id ?? null;

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

describe("nextPersonalisedQuestion: minimum answers before skipping", () => {
  it("defaults to 2", () => {
    assert.equal(DEFAULT_MIN_ANSWERS, 2);
    // a is above threshold after one answer, but one answer is not enough by default.
    const id = nextPersonalisedQuestion(topics, questions, new Set(["a-1"]), new Map([["a", 0.97]]));
    assert.equal(id?.id, "a-2");
  });

  it("does not skip a topic mastered after one lucky answer", () => {
    assert.equal(next(["a-1"], { ...low, a: 0.97 }, 2), "a-2");
  });

  it("skips it once enough questions are answered", () => {
    assert.equal(next(["a-1", "a-2"], { ...low, a: 0.97 }, 2), "b-1");
  });

  it("does not skip a topic mastered from the prior alone", () => {
    assert.equal(next([], { a: 0.99, b: 0.99, c: 0.3 }, 2), "a-1");
  });

  it("still requires the threshold, however many answers", () => {
    assert.equal(next(["b-1", "b-2"], { a: 0.99, b: 0.5, c: 0.3 }, 0), "c-1");
    assert.equal(next(["a-1", "a-2"], { ...low, a: 0.9 }, 2), "b-1"); // exhausted, not mastered
  });

  it("moves on from a topic with fewer questions than minAnswers once they run out", () => {
    assert.equal(next(["c-1"], { a: 0.99, b: 0.99, c: 0.99 }, 3), "a-1");
    assert.equal(next(["a-1", "a-2", "b-1", "b-2", "c-1"], { a: 0.99, b: 0.99, c: 0.99 }, 3), null);
  });
});
