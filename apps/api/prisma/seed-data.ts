export type OptionKey = "A" | "B" | "C" | "D";

export const SOURCE = "sample (WAEC/JAMB style, not a past question)";

export const topics = [
  { id: "number-bases", name: "Number Bases" },
  { id: "fractions-percentages", name: "Fractions, Ratio and Percentages" },
  { id: "indices-logs-surds", name: "Indices, Logarithms and Surds" },
  { id: "sets", name: "Sets" },
  { id: "linear-equations", name: "Linear Equations and Inequalities" },
  { id: "quadratics", name: "Quadratic Equations" },
  { id: "sequences-series", name: "Sequences and Series" },
  { id: "geometry-mensuration", name: "Geometry and Mensuration" },
  { id: "trigonometry", name: "Trigonometry" },
  { id: "statistics-probability", name: "Statistics and Probability" },
] as const;

type TopicId = (typeof topics)[number]["id"];

function question(
  id: string,
  topicId: TopicId,
  difficulty: 1 | 2 | 3,
  stem: string,
  [A, B, C, D]: [string, string, string, string],
  answer: OptionKey,
) {
  return { id, topicId, difficulty, stem, options: { A, B, C, D }, answer, source: SOURCE };
}

export const questions = [
  question("number-bases-01", "number-bases", 1,
    "Convert 10110₂ to base ten.",
    ["22", "26", "13", "44"], "A"),
  question("number-bases-02", "number-bases", 2,
    "Evaluate 234₅ + 143₅, leaving your answer in base five.",
    ["377₅", "422₅", "432₅", "1032₅"], "C"),

  question("fractions-percentages-01", "fractions-percentages", 1,
    "A trader bought a bag for ₦4,000 and sold it for ₦5,000. What was the percentage profit?",
    ["20%", "25%", "10%", "80%"], "B"),
  question("fractions-percentages-02", "fractions-percentages", 2,
    "₦7,200 is shared among Ada, Bola and Chidi in the ratio 2 : 3 : 4. How much does Chidi receive?",
    ["₦1,600", "₦2,400", "₦1,800", "₦3,200"], "D"),

  question("indices-logs-surds-01", "indices-logs-surds", 2,
    "Evaluate 27^(2/3).",
    ["18", "3", "9", "81"], "C"),
  question("indices-logs-surds-02", "indices-logs-surds", 2,
    "Simplify √50 + √18.",
    ["8√2", "2√17", "34√2", "15√2"], "A"),

  question("sets-01", "sets", 1,
    "If P = {1, 2, 3, 4} and Q = {3, 4, 5}, find P ∩ Q.",
    ["{1, 2}", "{3, 4}", "{5}", "{1, 2, 3, 4, 5}"], "B"),
  question("sets-02", "sets", 2,
    "In a class of 40 students, 25 offer Physics, 20 offer Chemistry and 8 offer both. How many offer neither?",
    ["5", "8", "12", "3"], "D"),

  question("linear-equations-01", "linear-equations", 1,
    "Solve 3x − 7 = 11.",
    ["6", "4/3", "18", "54"], "A"),
  question("linear-equations-02", "linear-equations", 2,
    "Solve the inequality 5 − 2x > 11.",
    ["x > −3", "x < 3", "x < −3", "x > 3"], "C"),

  question("quadratics-01", "quadratics", 2,
    "Find the roots of x² − 5x + 6 = 0.",
    ["−2 and −3", "2 and 3", "−1 and 6", "1 and −6"], "B"),
  question("quadratics-02", "quadratics", 3,
    "If α and β are the roots of 2x² − 6x + 1 = 0, find α² + β².",
    ["9", "10", "7", "8"], "D"),

  question("sequences-series-01", "sequences-series", 1,
    "Find the 10th term of the arithmetic progression 3, 7, 11, …",
    ["39", "43", "40", "36"], "A"),
  question("sequences-series-02", "sequences-series", 2,
    "Find the sum of the first 5 terms of the geometric progression 2, 6, 18, …",
    ["80", "162", "242", "728"], "C"),

  question("geometry-mensuration-01", "geometry-mensuration", 1,
    "Two angles of a triangle are 48° and 67°. Find the third angle.",
    ["55°", "65°", "75°", "115°"], "B"),
  question("geometry-mensuration-02", "geometry-mensuration", 2,
    "Find the volume of a cylinder of radius 7 cm and height 10 cm. [Take π = 22/7]",
    ["440 cm³", "220 cm³", "2156 cm³", "1540 cm³"], "D"),

  question("trigonometry-01", "trigonometry", 2,
    "If sin θ = 3/5 and θ is acute, find cos θ.",
    ["4/5", "3/4", "5/4", "2/5"], "A"),
  question("trigonometry-02", "trigonometry", 3,
    "From a point 20 m from the foot of a vertical mast, the angle of elevation of its top is 60°. Find the height of the mast.",
    ["10√3 m", "40 m", "20√3 m", "10 m"], "C"),

  question("statistics-probability-01", "statistics-probability", 1,
    "Find the mean of 4, 8, 6, 10 and 12.",
    ["6", "8", "10", "40"], "B"),
  question("statistics-probability-02", "statistics-probability", 2,
    "A bag contains 5 red and 3 blue balls. Two balls are drawn at random without replacement. Find the probability that both are red.",
    ["25/64", "5/8", "3/28", "5/14"], "D"),
];
