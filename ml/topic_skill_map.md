# Topic → skill map (Q-matrix): DRAFT for review

`topic_skill_map.csv` links each WAEC/JAMB topic (ids from `apps/api/prisma/seed-data.ts`)
to the ASSISTments 2009 skills that test the same knowledge. The model service averages the
mapped skills' BKT parameters to get one parameter set per topic.

**Status: a first draft written without the dataset on hand.** Skill names were written from
memory of the ASSISTments 2009 skill list. Run `python check_topic_skill_map.py` once
`data/` and `artifacts/` exist, and fix any name it reports. The mapping is a methodological
choice: review it, and justify it in the methods chapter.

## Rationale and weak spots

| Topic | Match | Notes |
|---|---|---|
| Number Bases | **none** | ASSISTments has no base-conversion skill. Uses default parameters. |
| Fractions, Ratio and Percentages | strong | Fraction operations, percent, proportion, unit rate. |
| Indices, Logarithms and Surds | partial | Exponents and square roots only; no logarithms or surd manipulation. |
| Sets | weak | Venn Diagram only. |
| Linear Equations and Inequalities | strong | |
| Quadratic Equations | partial | Quadratic formula, factorising, quadratic patterns. |
| Sequences and Series | weak | Linear patterns ≈ arithmetic progressions; nothing for geometric series. |
| Geometry and Mensuration | strong | Area, perimeter, volume, surface area, angles. |
| Trigonometry | **very weak** | Pythagorean Theorem only; ASSISTments 2009 has no trig ratios. |
| Statistics and Probability | strong | |

Topics with no or weak matches are themselves a finding for RQ1: knowledge tracing trained on
foreign data can only transfer where the curricula overlap. Consider reporting AUC per topic,
grouped by match strength.

Possible later changes: drop the weak single-skill mappings (so those topics use the
default parameters, like Number Bases), or fit parameters for unmatched topics on the
pilot's own data after the study.
