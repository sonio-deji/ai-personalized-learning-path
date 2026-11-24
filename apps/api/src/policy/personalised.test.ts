import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_MAX_PER_TOPIC, DEFAULT_MIN_ANSWERS, MASTERY_THRESHOLD, nextPersonalisedQuestion } from "./personalised.js";

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

  it("reviews when every topic is mastered or exhausted", () => {
    // a and b mastered, c used up: review the lowest p_known topic that has questions left (a)
    assert.equal(next(["c-1"], { a: 0.96, b: 0.99, c: 0.4 }), "a-1");
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

describe("nextPersonalisedQuestion: review after everything is mastered", () => {
  const all = { a: 0.99, b: 0.97, c: 0.98 };

  it("picks the lowest p_known topic with questions left", () => {
    // all mastered (minAnswers 0): b has the lowest p_known
    assert.equal(next([], all), "b-1");
  });

  it("skips review topics that are used up", () => {
    assert.equal(next(["b-1", "b-2"], all), "c-1");
  });

  it("keeps curriculum order for equal p_known", () => {
    assert.equal(next([], { a: 0.97, b: 0.97, c: 0.97 }), "a-1");
  });

  it("returns null only when no question is left", () => {
    assert.equal(next(["a-1", "a-2", "b-1", "b-2", "c-1"], all), null);
  });
});

describe("nextPersonalisedQuestion: at most maxPerTopic questions per topic in the first pass", () => {
  // Topic h has 8 questions; k and m have 3 each.
  const capTopics = [
    { id: "h", curriculumOrder: 1 },
    { id: "k", curriculumOrder: 2 },
    { id: "m", curriculumOrder: 3 },
  ];
  const capQuestions = [
    ...Array.from({ length: 8 }, (_, i) => ({ id: `h-${i}`, topicId: "h", difficulty: 1 })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: `k-${i}`, topicId: "k", difficulty: 1 })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: `m-${i}`, topicId: "m", difficulty: 1 })),
  ];
  const weak = new Map([["h", 0.2], ["k", 0.3], ["m", 0.4]]);
  const nextCap = (attempted: string[], maxPerTopic?: number) =>
    nextPersonalisedQuestion(capTopics, capQuestions, new Set(attempted), weak, { minAnswers: 0, maxPerTopic })
      ?.id ?? null;
  const h = (n: number) => Array.from({ length: n }, (_, i) => `h-${i}`);

  it("defaults to 5", () => {
    assert.equal(DEFAULT_MAX_PER_TOPIC, 5);
    assert.equal(nextCap(h(4)), "h-4");
    assert.equal(nextCap(h(5)), "k-0");
  });

  it("moves on from an unmastered topic after the cap", () => {
    assert.equal(nextCap(h(3), 3), "k-0");
  });

  it("reaches every topic before returning to a capped one", () => {
    assert.equal(nextCap([...h(5), "k-0", "k-1", "k-2"]), "m-0");
  });

  it("returns to the weakest topic in review once every topic has had its turn", () => {
    const all = [...h(5), "k-0", "k-1", "k-2", "m-0", "m-1", "m-2"];
    assert.equal(nextCap(all), "h-5"); // h has the lowest p_known and questions left
  });
});

describe("nextPersonalisedQuestion: leaves room for every topic within the practice length", () => {
  // Three weak topics with plenty of questions; minAnswers 2, so 2 are reserved per topic ahead.
  const t3 = [
    { id: "p", curriculumOrder: 1 },
    { id: "q", curriculumOrder: 2 },
    { id: "r", curriculumOrder: 3 },
  ];
  const qs = ["p", "q", "r"].flatMap((t) =>
    Array.from({ length: 8 }, (_, i) => ({ id: `${t}-${i}`, topicId: t, difficulty: 1 })),
  );
  const weakAll = new Map([["p", 0.2], ["q", 0.2], ["r", 0.2]]);
  const run = (length: number) => {
    const asked: string[] = [];
    for (let n = 0; n < length; n++) {
      const q = nextPersonalisedQuestion(t3, qs, new Set(asked), weakAll, { remaining: length - n });
      if (!q) break;
      asked.push(q.id);
    }
    return asked.map((id) => id[0]).join("");
  };

  it("gives a weak student every topic, at least 2 each, in a short practice", () => {
    assert.equal(run(6), "ppqqrr");
    assert.equal(run(8), "ppppqqrr");
  });

  it("uses up to maxPerTopic when there is room", () => {
    assert.equal(run(15), "pppppqqqqqrrrrr");
  });

  it("stays within the cap and the budget together", () => {
    assert.equal(run(10), "pppppqqqrr");
  });

  it("starts a topic even when the budget is short, rather than skipping it", () => {
    // 3 left, 4 owed to q and r: p is unvisited, so it still gets its first question
    const q = nextPersonalisedQuestion(t3, qs, new Set(), weakAll, { remaining: 3 });
    assert.equal(q?.id, "p-0");
  });
});
