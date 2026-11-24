// Pure helpers for the study (week 8): condition assignment, SUS scoring and CSV output.

export type Condition = "personalised" | "fixed";

export const BLOCK_SIZE = 4; // half personalised, half fixed in every block of 4 sign-ups

/**
 * Permuted-block randomisation without stored state. Participants are numbered in sign-up
 * order and grouped into blocks of BLOCK_SIZE; each block holds equal numbers of both
 * conditions in a random order. `inBlock` is the conditions already given in the current
 * block; the next one is drawn at random from the slots that remain, so after every full
 * block the groups are exactly equal and at any time they differ by at most BLOCK_SIZE / 2.
 *
 * `rand(n)` must return a uniform integer in [0, n).
 */
export function nextInBlock(inBlock: readonly Condition[], rand: (n: number) => number): Condition {
  const half = BLOCK_SIZE / 2;
  const personalisedLeft = half - inBlock.filter((c) => c === "personalised").length;
  const fixedLeft = half - inBlock.filter((c) => c === "fixed").length;
  // A block can hold more of one condition than half if conditions were forced in development
  // (NEW_USER_CONDITION); then give the other one. Both can't be full: a block holds at most
  // BLOCK_SIZE - 1 earlier sign-ups when the next is assigned.
  if (personalisedLeft <= 0) return "fixed";
  if (fixedLeft <= 0) return "personalised";
  return rand(personalisedLeft + fixedLeft) < personalisedLeft ? "personalised" : "fixed";
}

/** The standard SUS items (Brooke, 1996), with "system" replaced by "app". */
export const SUS_ITEMS = [
  "I think that I would like to use this app frequently.",
  "I found the app unnecessarily complex.",
  "I thought the app was easy to use.",
  "I think that I would need the support of a technical person to be able to use this app.",
  "I found the various functions in this app were well integrated.",
  "I thought there was too much inconsistency in this app.",
  "I would imagine that most people would learn to use this app very quickly.",
  "I found the app very cumbersome to use.",
  "I felt very confident using the app.",
  "I needed to learn a lot of things before I could get going with this app.",
] as const;

/** SUS score 0-100 from ten responses of 1-5: odd items r - 1, even items 5 - r, sum x 2.5. */
export function susScore(responses: readonly number[]): number {
  if (responses.length !== 10 || responses.some((r) => !Number.isInteger(r) || r < 1 || r > 5)) {
    throw new Error("SUS needs ten responses from 1 to 5");
  }
  const sum = responses.reduce((acc, r, i) => acc + (i % 2 === 0 ? r - 1 : 5 - r), 0);
  return sum * 2.5;
}

/** RFC 4180 CSV: quote fields containing a comma, quote or line break; null becomes empty. */
export function toCsv(header: readonly string[], rows: readonly (readonly unknown[])[]): string {
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = v instanceof Date ? v.toISOString() : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export type Stage = "pre_test" | "practice" | "post_test" | "survey" | "finished";

/** Where a participant is in the study. Practice ends when the policy has no next question. */
export function stageOf(s: { preDone: boolean; practiceDone: boolean; postDone: boolean; susDone: boolean }): Stage {
  if (!s.preDone) return "pre_test";
  if (!s.practiceDone) return "practice";
  if (!s.postDone) return "post_test";
  if (!s.susDone) return "survey";
  return "finished";
}
