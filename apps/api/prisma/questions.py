"""Question bank: independent answer checks for every question in seed-data.ts.

seed-data.ts is what gets seeded. This file holds a second copy of each question together
with a calculation of its answer, so that no answer key relies on a single hand-written
letter. Each q(...) lists the CORRECT option first, followed by the distractors, and has a
check() that recomputes the answer: it must return the correct option's exact text (or True
when the answer isn't a single value, e.g. a factorisation verified at many points).

Usage (Python 3.8+, standard library only), from the repository root:

    python3 apps/api/prisma/questions.py            # verify everything against seed-data.ts
    python3 apps/api/prisma/questions.py --emit     # print TypeScript for questions not yet seeded

Adding questions: add q(...) entries below, run --emit and paste each printed group after
that topic's last question in seed-data.ts, then run the verification again.

A passing check means the intended answer is right. It does not prove that no distractor is
also right (e.g. the same set written another way), so read the options too, and have a
maths teacher review new questions before students see them.
"""
import json
import re
import math
import sys
from collections import Counter
from fractions import Fraction as F
from itertools import combinations
from pathlib import Path

def base(n, b):
    d = ""
    while n:
        d = str(n % b) + d
        n //= b
    return d or "0"

def from_base(s, b):
    return int(s, b)

SUB = str.maketrans("0123456789", "₀₁₂₃₄₅₆₇₈₉")
def nb(s, b):  # "11001", 2 -> "11001₂"
    return f"{s}{str(b).translate(SUB)}"

def frac(fr):  # Fraction -> "a/b" or "a"
    return str(fr.numerator) if fr.denominator == 1 else f"{fr.numerator}/{fr.denominator}"

def mixed(fr):
    w, r = divmod(fr.numerator, fr.denominator)
    return f"{w} {frac(F(r, fr.denominator))}" if w and r else frac(fr)

Q = []
def q(id, topic, diff, stem, options, check):
    Q.append(dict(id=id, topic=topic, diff=diff, stem=stem, options=options, check=check))

# ---------------- Number bases
T = "number-bases"
q(f"{T}-01", T, 1, "Convert 10110₂ to base ten.",
  ["22", "26", "13", "44"], lambda: str(from_base("10110", 2)))
q(f"{T}-02", T, 2, "Evaluate 234₅ + 143₅, leaving your answer in base five.",
  ["432₅", "377₅", "422₅", "1032₅"], lambda: nb(base(from_base("234", 5) + from_base("143", 5), 5), 5))
q(f"{T}-03", T, 1, "Convert 25 (base ten) to base two.",
  ["11001₂", "10011₂", "11010₂", "10101₂"], lambda: nb(base(25, 2), 2))
q(f"{T}-04", T, 1, "Convert 123₄ to base ten.",
  ["27", "123", "18", "30"], lambda: str(from_base("123", 4)))
q(f"{T}-05", T, 2, "Find x if 21ₓ = 13 (base ten).",
  ["6", "4", "5", "7"], lambda: str(next(x for x in range(3, 11) if 2 * x + 1 == 13)))
q(f"{T}-06", T, 2, "Evaluate 12₃ × 21₃, leaving your answer in base three.",
  ["1022₃", "1102₃", "1012₃", "2101₃"], lambda: nb(base(from_base("12", 3) * from_base("21", 3), 3), 3))
q(f"{T}-07", T, 2, "Subtract 101₂ from 1101₂.",
  ["1000₂", "1010₂", "110₂", "1001₂"], lambda: nb(base(0b1101 - 0b101, 2), 2))
q(f"{T}-08", T, 2, "Convert 0.101₂ to a decimal in base ten.",
  ["0.625", "0.5", "0.375", "0.101"], lambda: str(float(F(1, 2) + F(1, 8))))
q(f"{T}-09", T, 3, "Find the digit x if 2x7₈ = 191 (base ten).",
  ["7", "5", "6", "3"], lambda: str(next(x for x in range(8) if 2 * 64 + 8 * x + 7 == 191)))
q(f"{T}-10", T, 3, "Evaluate 1001₂ × 11₂, giving your answer in base five.",
  ["102₅", "112₅", "120₅", "202₅"], lambda: nb(base(0b1001 * 0b11, 5), 5))

# ---------------- Fractions, ratio, percentages
T = "fractions-percentages"
q(f"{T}-01", T, 1, "A trader bought a bag for ₦4,000 and sold it for ₦5,000. What was the percentage profit?",
  ["25%", "20%", "10%", "80%"], lambda: f"{(5000 - 4000) * 100 // 4000}%")
q(f"{T}-02", T, 2, "₦7,200 is shared among Ada, Bola and Chidi in the ratio 2 : 3 : 4. How much does Chidi receive?",
  ["₦3,200", "₦1,600", "₦2,400", "₦1,800"], lambda: f"₦{7200 * 4 // (2 + 3 + 4):,}")
q(f"{T}-03", T, 1, "Simplify 2/3 + 3/4.",
  ["1 5/12", "5/7", "1/2", "1 1/12"], lambda: mixed(F(2, 3) + F(3, 4)))
q(f"{T}-04", T, 1, "Express 0.375 as a fraction in its lowest terms.",
  ["3/8", "37/100", "5/8", "3/4"], lambda: frac(F("0.375")))
q(f"{T}-05", T, 1, "Find 15% of ₦8,000.",
  ["₦1,200", "₦120", "₦12,000", "₦1,500"], lambda: f"₦{8000 * 15 // 100:,}")
q(f"{T}-06", T, 2, "Simplify (1 1/2 ÷ 3/4) × 2/5.",
  ["4/5", "9/20", "5/4", "1 1/5"], lambda: frac(F(3, 2) / F(3, 4) * F(2, 5)))
q(f"{T}-07", T, 2, "A man spends 2/5 of his salary on rent and 1/4 of the remainder on food. What fraction of his salary is left?",
  ["9/20", "7/20", "13/20", "3/20"], lambda: frac(1 - F(2, 5) - F(1, 4) * (1 - F(2, 5))))
q(f"{T}-08", T, 2, "The price of an article rose from ₦2,500 to ₦3,000. Find the percentage increase.",
  ["20%", "16 2/3%", "25%", "500%"], lambda: f"{(3000 - 2500) * 100 // 2500}%")
q(f"{T}-09", T, 3, "A trader sold an article for ₦4,600 at a loss of 8%. Find the cost price.",
  ["₦5,000", "₦4,968", "₦4,232", "₦5,368"], lambda: f"₦{int(F(4600) / F(92, 100)):,}")
q(f"{T}-10", T, 3, "If x : y = 3 : 4 and y : z = 6 : 5, find x : z.",
  ["9 : 10", "18 : 5", "1 : 2", "10 : 9"], lambda: "{} : {}".format(*(lambda r: (r.numerator, r.denominator))(F(3, 4) * F(6, 5))))

# ---------------- Indices, logarithms, surds
T = "indices-logs-surds"
q(f"{T}-01", T, 2, "Evaluate 27^(2/3).",
  ["9", "18", "3", "81"], lambda: str(round(27 ** (2 / 3))))
q(f"{T}-02", T, 2, "Simplify √50 + √18.",
  ["8√2", "2√17", "34√2", "15√2"], lambda: "8√2" if math.isclose(math.sqrt(50) + math.sqrt(18), 8 * math.sqrt(2)) else None)
q(f"{T}-03", T, 1, "Simplify 2³ × 2⁴.",
  ["2⁷", "2¹²", "4⁷", "4¹²"], lambda: True if 2**3 * 2**4 == 2**7 else None)
q(f"{T}-04", T, 1, "Evaluate log₁₀ 1000.",
  ["3", "30", "100", "4"], lambda: str(round(math.log10(1000))))
q(f"{T}-05", T, 2, "Evaluate 16^(−3/4).",
  ["1/8", "−12", "8", "1/12"], lambda: frac(F(1, round(16 ** 0.75))))
q(f"{T}-06", T, 2, "Evaluate log₂ 8 + log₃ 9.",
  ["5", "6", "1", "17"], lambda: str(round(math.log2(8) + math.log(9, 3))))
q(f"{T}-07", T, 2, "Rationalise 6/√3.",
  ["2√3", "3√2", "6√3", "√3/2"], lambda: True if math.isclose(6 / math.sqrt(3), 2 * math.sqrt(3)) else None)
q(f"{T}-08", T, 2, "Solve 3^(x + 1) = 81.",
  ["3", "4", "2", "27"], lambda: str(next(x for x in range(10) if 3 ** (x + 1) == 81)))
q(f"{T}-09", T, 3, "Given that log 2 = 0.3010 and log 3 = 0.4771, find log 12.",
  ["1.0791", "0.7781", "1.2041", "0.9542"], lambda: f"{2 * 0.3010 + 0.4771:.4f}")
q(f"{T}-10", T, 3, "Simplify (√5 + √3)(√5 − √3).",
  ["2", "8", "√2", "2√15"], lambda: str(round((math.sqrt(5) + math.sqrt(3)) * (math.sqrt(5) - math.sqrt(3)))))

# ---------------- Sets
T = "sets"
fmt = lambda s: "{" + ", ".join(map(str, sorted(s))) + "}"
q(f"{T}-01", T, 1, "If P = {1, 2, 3, 4} and Q = {3, 4, 5}, find P ∩ Q.",
  ["{3, 4}", "{1, 2}", "{5}", "{1, 2, 3, 4, 5}"], lambda: fmt({1, 2, 3, 4} & {3, 4, 5}))
q(f"{T}-02", T, 2, "In a class of 40 students, 25 offer Physics, 20 offer Chemistry and 8 offer both. How many offer neither?",
  ["3", "5", "8", "12"], lambda: str(40 - (25 + 20 - 8)))
q(f"{T}-03", T, 1, "If A = {2, 4, 6, 8} and B = {1, 2, 3, 4}, find A ∪ B.",
  ["{1, 2, 3, 4, 6, 8}", "{2, 4}", "{1, 3, 6, 8}", "{1, 2, 3, 4, 5, 6, 7, 8}"], lambda: fmt({2, 4, 6, 8} | {1, 2, 3, 4}))
q(f"{T}-04", T, 1, "How many subsets does the set {a, b, c} have?",
  ["8", "3", "6", "9"], lambda: str(2 ** 3))
q(f"{T}-05", T, 1, "U = {1, 2, 3, …, 10} and P = {multiples of 3}. Find P′.",
  ["{1, 2, 4, 5, 7, 8, 10}", "{3, 6, 9}", "{1, 2, 4, 5, 7, 8}", "{2, 4, 6, 8, 10}"], lambda: fmt(set(range(1, 11)) - {3, 6, 9}))
q(f"{T}-06", T, 2, "If n(A) = 15, n(B) = 12 and n(A ∩ B) = 5, find n(A ∪ B).",
  ["22", "27", "32", "17"], lambda: str(15 + 12 - 5))
q(f"{T}-07", T, 2, "X = {x : 2 < x ≤ 7, x is an integer}. Find n(X).",
  ["5", "6", "4", "7"], lambda: str(len([x for x in range(-10, 20) if 2 < x <= 7])))
q(f"{T}-08", T, 2, "A = {prime numbers less than 10} and B = {odd numbers less than 10}. Find A ∩ B.",
  ["{3, 5, 7}", "{2, 3, 5, 7}", "{1, 3, 5, 7, 9}", "{1, 9}"],
  lambda: fmt({p for p in range(2, 10) if all(p % d for d in range(2, p))} & {o for o in range(1, 10) if o % 2}))
q(f"{T}-09", T, 3, "In a market of 50 traders, 30 sell rice, 25 sell beans and 10 sell neither. How many sell both?",
  ["15", "5", "10", "20"], lambda: str(30 + 25 - (50 - 10)))
q(f"{T}-10", T, 3, "Of 60 students, 35 offer Biology, 30 offer Physics, x offer both and 5 offer neither. Find x.",
  ["10", "5", "15", "25"], lambda: str(next(x for x in range(31) if 35 + 30 - x + 5 == 60)))

# ---------------- Linear equations and inequalities
T = "linear-equations"
q(f"{T}-01", T, 1, "Solve 3x − 7 = 11.",
  ["6", "4/3", "18", "54"], lambda: str(next(x for x in range(-20, 21) if 3 * x - 7 == 11)))
q(f"{T}-02", T, 2, "Solve the inequality 5 − 2x > 11.",
  ["x < −3", "x > −3", "x < 3", "x > 3"],
  lambda: "x < −3" if all((5 - 2 * x > 11) == (x < -3) for x in [i / 4 for i in range(-80, 81)]) else None)
q(f"{T}-03", T, 1, "Solve 2(x + 3) = 14.",
  ["4", "5.5", "8", "10"], lambda: str(next(x for x in range(-20, 21) if 2 * (x + 3) == 14)))
q(f"{T}-04", T, 1, "Solve x/3 + 2 = 5.",
  ["9", "1", "21", "3"], lambda: str(next(x for x in range(-30, 31) if F(x, 3) + 2 == 5)))
q(f"{T}-05", T, 2, "Solve the simultaneous equations x + y = 7 and x − y = 1.",
  ["x = 4, y = 3", "x = 3, y = 4", "x = 5, y = 2", "x = 6, y = 1"],
  lambda: next(f"x = {x}, y = {y}" for x in range(-10, 11) for y in range(-10, 11) if x + y == 7 and x - y == 1))
q(f"{T}-06", T, 2, "Solve the inequality 3x − 4 ≤ 2x + 1.",
  ["x ≤ 5", "x ≥ 5", "x ≤ −3", "x ≥ −5"],
  lambda: "x ≤ 5" if all((3 * x - 4 <= 2 * x + 1) == (x <= 5) for x in range(-50, 51)) else None)
q(f"{T}-07", T, 2, "Solve (2x − 1)/3 = (x + 2)/2.",
  ["8", "4", "−8", "1"], lambda: str(next(x for x in range(-20, 21) if F(2 * x - 1, 3) == F(x + 2, 2))))
q(f"{T}-08", T, 2, "The sum of two numbers is 25 and their difference is 7. Find the larger number.",
  ["16", "9", "18", "32"], lambda: str((25 + 7) // 2))
q(f"{T}-09", T, 3, "Solve the simultaneous equations 2x + 3y = 12 and 3x − y = 7.",
  ["x = 3, y = 2", "x = 2, y = 3", "x = 3, y = −2", "x = 1, y = 4"],
  lambda: next(f"x = {x}, y = {y}" for x in range(-10, 11) for y in range(-10, 11) if 2 * x + 3 * y == 12 and 3 * x - y == 7))
q(f"{T}-10", T, 3, "Find the range of values of x for which 1 < 2x − 3 < 7.",
  ["2 < x < 5", "−1 < x < 2", "4 < x < 10", "1 < x < 5"],
  lambda: "2 < x < 5" if all((1 < 2 * x - 3 < 7) == (2 < x < 5) for x in [i / 4 for i in range(-40, 41)]) else None)

# ---------------- Quadratic equations
T = "quadratics"
roots = lambda a, b, c: sorted(((-b + s * math.sqrt(b * b - 4 * a * c)) / (2 * a)) for s in (1, -1))
q(f"{T}-01", T, 2, "Find the roots of x² − 5x + 6 = 0.",
  ["2 and 3", "−2 and −3", "−1 and 6", "1 and −6"], lambda: "2 and 3" if roots(1, -5, 6) == [2, 3] else None)
q(f"{T}-02", T, 3, "If α and β are the roots of 2x² − 6x + 1 = 0, find α² + β².",
  ["8", "9", "10", "7"], lambda: str(round(sum(r * r for r in roots(2, -6, 1)))))
q(f"{T}-03", T, 1, "Solve x² − 9 = 0.",
  ["x = 3 or x = −3", "x = 9 only", "x = 3 only", "x = 4.5 or x = −4.5"],
  lambda: "x = 3 or x = −3" if roots(1, 0, -9) == [-3, 3] else None)
q(f"{T}-04", T, 1, "Factorise x² + 7x + 12.",
  ["(x + 3)(x + 4)", "(x + 2)(x + 6)", "(x − 3)(x − 4)", "(x + 1)(x + 12)"],
  lambda: "(x + 3)(x + 4)" if all((x + 3) * (x + 4) == x * x + 7 * x + 12 for x in range(-9, 9)) else None)
q(f"{T}-05", T, 2, "Solve 2x² + x − 6 = 0.",
  ["x = 3/2 or x = −2", "x = −3/2 or x = 2", "x = 3 or x = −2", "x = 2 or x = 3"],
  lambda: "x = 3/2 or x = −2" if roots(2, 1, -6) == [-2, 1.5] else None)
q(f"{T}-06", T, 2, "Find the sum of the roots of 3x² − 12x + 5 = 0.",
  ["4", "−4", "5/3", "12"], lambda: str(round(sum(roots(3, -12, 5)))))
q(f"{T}-07", T, 2, "Find the quadratic equation whose roots are 2 and −5.",
  ["x² + 3x − 10 = 0", "x² − 3x − 10 = 0", "x² + 3x + 10 = 0", "x² − 7x + 10 = 0"],
  lambda: "x² + 3x − 10 = 0" if roots(1, 3, -10) == [-5, 2] else None)
q(f"{T}-08", T, 2, "Find the value of k for which x² − 6x + k = 0 has equal roots.",
  ["9", "36", "−9", "6"], lambda: str(next(k for k in range(-50, 51) if 36 - 4 * k == 0)))
q(f"{T}-09", T, 3, "Solve x² − 4x − 1 = 0, correct to two decimal places.",
  ["x = 4.24 or x = −0.24", "x = 4.24 or x = 0.24", "x = 2.24 or x = −2.24", "x = −4.24 or x = 0.24"],
  lambda: "x = {:.2f} or x = −{:.2f}".format(roots(1, -4, -1)[1], -roots(1, -4, -1)[0]))
q(f"{T}-10", T, 3, "The product of two consecutive positive integers is 132. Find the larger integer.",
  ["12", "11", "13", "66"], lambda: str(next(n + 1 for n in range(1, 100) if n * (n + 1) == 132)))

# ---------------- Sequences and series
T = "sequences-series"
q(f"{T}-01", T, 1, "Find the 10th term of the arithmetic progression 3, 7, 11, …",
  ["39", "43", "40", "36"], lambda: str(3 + 9 * 4))
q(f"{T}-02", T, 2, "Find the sum of the first 5 terms of the geometric progression 2, 6, 18, …",
  ["242", "80", "162", "728"], lambda: str(sum(2 * 3 ** i for i in range(5))))
q(f"{T}-03", T, 1, "Find the next term of the sequence 5, 10, 20, 40, …",
  ["80", "60", "45", "160"], lambda: str(40 * 2))
q(f"{T}-04", T, 1, "Find the common difference of the arithmetic progression 17, 13, 9, …",
  ["−4", "4", "13", "−13"], lambda: str(13 - 17).replace("-", "−"))
q(f"{T}-05", T, 2, "Find the 6th term of the geometric progression 3, 6, 12, …",
  ["96", "48", "192", "18"], lambda: str(3 * 2 ** 5))
q(f"{T}-06", T, 2, "Find the sum of the first 20 terms of the arithmetic progression 2, 5, 8, …",
  ["610", "590", "1220", "59"], lambda: str(sum(2 + 3 * i for i in range(20))))
q(f"{T}-07", T, 2, "The 3rd term of an arithmetic progression is 11 and the 7th term is 23. Find the common difference.",
  ["3", "4", "12", "6"], lambda: str((23 - 11) // 4))
q(f"{T}-08", T, 2, "How many terms are in the arithmetic progression 4, 7, 10, …, 61?",
  ["20", "19", "21", "57"], lambda: str(len(range(4, 62, 3))))
q(f"{T}-09", T, 3, "Find the sum to infinity of the geometric progression 18, 6, 2, …",
  ["27", "26", "54", "36"], lambda: frac(F(18) / (1 - F(1, 3))))
q(f"{T}-10", T, 3, "The first term of a geometric progression is 5 and the 4th term is 40. Find the sum of the first 5 terms.",
  ["155", "160", "80", "75"], lambda: str(sum(5 * 2 ** i for i in range(5))) if 5 * 2 ** 3 == 40 else None)

# ---------------- Geometry and mensuration
T = "geometry-mensuration"
PI = F(22, 7)
q(f"{T}-01", T, 1, "Two angles of a triangle are 48° and 67°. Find the third angle.",
  ["65°", "55°", "75°", "115°"], lambda: f"{180 - 48 - 67}°")
q(f"{T}-02", T, 2, "Find the volume of a cylinder of radius 7 cm and height 10 cm. [Take π = 22/7]",
  ["1540 cm³", "440 cm³", "220 cm³", "2156 cm³"], lambda: f"{frac(PI * 7 * 7 * 10)} cm³")
q(f"{T}-03", T, 1, "Find the area of a rectangle 12 cm long and 7 cm wide.",
  ["84 cm²", "38 cm²", "19 cm²", "168 cm²"], lambda: f"{12 * 7} cm²")
q(f"{T}-04", T, 1, "Find the size of each interior angle of a regular hexagon.",
  ["120°", "60°", "135°", "108°"], lambda: f"{(6 - 2) * 180 // 6}°")
q(f"{T}-05", T, 1, "Find the circumference of a circle of radius 14 cm. [Take π = 22/7]",
  ["88 cm", "44 cm", "616 cm", "176 cm"], lambda: f"{frac(2 * PI * 14)} cm")
q(f"{T}-06", T, 2, "The hypotenuse of a right-angled triangle is 13 cm and one of the other sides is 5 cm. Find the third side.",
  ["12 cm", "8 cm", "18 cm", "√194 cm"], lambda: f"{math.isqrt(13**2 - 5**2)} cm")
q(f"{T}-07", T, 2, "Find the area of a trapezium whose parallel sides are 8 cm and 12 cm and whose height is 5 cm.",
  ["50 cm²", "100 cm²", "480 cm²", "25 cm²"], lambda: f"{(8 + 12) * 5 // 2} cm²")
q(f"{T}-08", T, 2, "Two angles are supplementary and one is three times the other. Find the smaller angle.",
  ["45°", "22.5°", "60°", "135°"], lambda: f"{180 // 4}°")
q(f"{T}-09", T, 3, "Find the total surface area of a closed cylinder of radius 7 cm and height 10 cm. [Take π = 22/7]",
  ["748 cm²", "440 cm²", "1540 cm²", "594 cm²"], lambda: f"{frac(2 * PI * 7 * (7 + 10))} cm²")
q(f"{T}-10", T, 3, "The sum of the interior angles of a polygon is 1440°. How many sides does it have?",
  ["10", "8", "12", "9"], lambda: str(1440 // 180 + 2))

# ---------------- Trigonometry
T = "trigonometry"
d = math.radians
q(f"{T}-01", T, 2, "If sin θ = 3/5 and θ is acute, find cos θ.",
  ["4/5", "3/4", "5/4", "2/5"], lambda: "4/5" if math.isclose(math.cos(math.asin(0.6)), 0.8) else None)
q(f"{T}-02", T, 3, "From a point 20 m from the foot of a vertical mast, the angle of elevation of its top is 60°. Find the height of the mast.",
  ["20√3 m", "10√3 m", "40 m", "10 m"], lambda: "20√3 m" if math.isclose(20 * math.tan(d(60)), 20 * math.sqrt(3)) else None)
q(f"{T}-03", T, 1, "Evaluate sin 30° + cos 60°.",
  ["1", "1/2", "√3", "0"], lambda: "1" if math.isclose(math.sin(d(30)) + math.cos(d(60)), 1) else None)
q(f"{T}-04", T, 1, "In a right-angled triangle, the side opposite angle θ is 5 cm and the side adjacent to θ is 12 cm. Find tan θ.",
  ["5/12", "12/5", "5/13", "12/13"], lambda: frac(F(5, 12)))
q(f"{T}-05", T, 2, "If tan θ = 3/4 and θ is acute, find sin θ.",
  ["3/5", "4/5", "3/4", "5/3"], lambda: "3/5" if math.isclose(math.sin(math.atan(0.75)), 0.6) else None)
q(f"{T}-06", T, 2, "Without using tables, find the value of cos 300°.",
  ["1/2", "−1/2", "√3/2", "−√3/2"], lambda: "1/2" if math.isclose(math.cos(d(300)), 0.5) else None)
q(f"{T}-07", T, 2, "A ladder 10 m long leans against a vertical wall and makes an angle of 60° with the ground. How far is the foot of the ladder from the wall?",
  ["5 m", "5√3 m", "10√3 m", "20 m"], lambda: "5 m" if math.isclose(10 * math.cos(d(60)), 5) else None)
q(f"{T}-08", T, 2, "Simplify sin²θ + cos²θ + tan θ cos θ.",
  ["1 + sin θ", "1 + cos θ", "2", "sin θ"],
  lambda: "1 + sin θ" if all(math.isclose(math.sin(t)**2 + math.cos(t)**2 + math.tan(t) * math.cos(t), 1 + math.sin(t)) for t in (0.3, 0.9, 1.2)) else None)
q(f"{T}-09", T, 3, "A boy walks 8 km due north and then 6 km due east. How far is he from his starting point?",
  ["10 km", "14 km", "2 km", "100 km"], lambda: f"{round(math.hypot(8, 6))} km")
q(f"{T}-10", T, 3, "A vertical pole 6 m high casts a shadow 6√3 m long. Find the angle of elevation of the sun.",
  ["30°", "60°", "45°", "15°"], lambda: f"{round(math.degrees(math.atan(6 / (6 * math.sqrt(3)))))}°")

# ---------------- Statistics and probability
T = "statistics-probability"
q(f"{T}-01", T, 1, "Find the mean of 4, 8, 6, 10 and 12.",
  ["8", "6", "10", "40"], lambda: str(sum([4, 8, 6, 10, 12]) // 5))
q(f"{T}-02", T, 2, "A bag contains 5 red and 3 blue balls. Two balls are drawn at random without replacement. Find the probability that both are red.",
  ["5/14", "25/64", "5/8", "3/28"], lambda: frac(F(5, 8) * F(4, 7)))
q(f"{T}-03", T, 1, "Find the median of 7, 3, 9, 5 and 11.",
  ["7", "9", "5", "35"], lambda: str(sorted([7, 3, 9, 5, 11])[2]))
q(f"{T}-04", T, 1, "Find the mode of 2, 3, 3, 4, 5, 5, 5, 6.",
  ["5", "3", "4", "6"], lambda: str(max(set(L := [2, 3, 3, 4, 5, 5, 5, 6]), key=L.count)))
q(f"{T}-05", T, 1, "A fair die is thrown once. Find the probability of getting a number greater than 4.",
  ["1/3", "1/6", "2/3", "1/2"], lambda: frac(F(len([n for n in range(1, 7) if n > 4]), 6)))
q(f"{T}-06", T, 2, "Find the range of 12, 7, 19, 3 and 15.",
  ["16", "12", "19", "22"], lambda: str(19 - 3))
q(f"{T}-07", T, 2, "The mean of five numbers is 8. Four of the numbers are 6, 9, 10 and 7. Find the fifth number.",
  ["8", "6", "32", "10"], lambda: str(5 * 8 - (6 + 9 + 10 + 7)))
q(f"{T}-08", T, 2, "Two fair coins are tossed together. Find the probability of getting at least one head.",
  ["3/4", "1/2", "1/4", "2/3"], lambda: frac(F(len([o for o in ["HH", "HT", "TH", "TT"] if "H" in o]), 4)))
q(f"{T}-09", T, 3, "Find the variance of 2, 4, 6 and 8.",
  ["5", "√5", "20", "20/3"], lambda: frac(F(sum((x - 5) ** 2 for x in [2, 4, 6, 8]), 4)))
q(f"{T}-10", T, 3, "In how many ways can 3 prefects be chosen from 8 students?",
  ["56", "336", "24", "11"], lambda: str(len(list(combinations(range(8), 3)))))

# ================ Pre/post-test items (testQuestions in seed-data.ts) =======================
# Used only in the pre- and post-test (the same 20 both times), never in practice.

T = "number-bases"
q(f"test-{T}-1", T, 2, "Convert 1011011₂ to base ten.",
  ["91", "93", "45", "182"], lambda: str(from_base("1011011", 2)))
q(f"test-{T}-2", T, 3, "Find n if 31ₙ = 25 (base ten).",
  ["8", "7", "6", "9"], lambda: str(next(n for n in range(4, 17) if 3 * n + 1 == 25)))

T = "fractions-percentages"
q(f"test-{T}-1", T, 2, "A shirt marked ₦6,000 is sold at a discount of 15%. Find the selling price.",
  ["₦5,100", "₦900", "₦5,850", "₦6,900"], lambda: f"₦{6000 * 85 // 100:,}")
q(f"test-{T}-2", T, 3, "Musa and Ngozi share a sum of money in the ratio 5 : 3. Musa gets ₦1,200 more than Ngozi. Find the sum shared.",
  ["₦4,800", "₦3,000", "₦1,800", "₦9,600"], lambda: f"₦{1200 // (5 - 3) * (5 + 3):,}")

T = "indices-logs-surds"
q(f"test-{T}-1", T, 2, "Simplify (8^(1/3) × 16^(1/2)) ÷ 2³.",
  ["1", "2", "1/2", "4"], lambda: str(round(8 ** (1 / 3) * 16 ** 0.5 / 2 ** 3)))
q(f"test-{T}-2", T, 3, "Solve log₂(x + 3) = 4.",
  ["13", "5", "1", "61"], lambda: str(next(x for x in range(-2, 100) if math.isclose(math.log2(x + 3), 4))))

T = "sets"
q(f"test-{T}-1", T, 2, "In a class, 18 students offer French, 22 offer Igbo, 7 offer both and 5 offer neither. How many students are in the class?",
  ["38", "52", "45", "33"], lambda: str(18 + 22 - 7 + 5))
q(f"test-{T}-2", T, 3, "If n(U) = 50, n(A) = 30, n(B) = 25 and n(A ∩ B) = 12, find n(A′ ∩ B′).",
  ["7", "12", "43", "5"], lambda: str(50 - (30 + 25 - 12)))

T = "linear-equations"
q(f"test-{T}-1", T, 2, "Solve 4(x − 2) − 3(x + 1) = 5.",
  ["16", "6", "−6", "4"], lambda: str(next(x for x in range(-50, 51) if 4 * (x - 2) - 3 * (x + 1) == 5)))
q(f"test-{T}-2", T, 3, "Solve the simultaneous equations 2x + y = 7 and x − 2y = −4.",
  ["x = 2, y = 3", "x = 3, y = 1", "x = 1, y = 5", "x = −2, y = 11"],
  lambda: next(f"x = {x}, y = {y}" for x in range(-10, 11) for y in range(-20, 21) if 2 * x + y == 7 and x - 2 * y == -4))

T = "quadratics"
q(f"test-{T}-1", T, 2, "Solve x² − 2x − 15 = 0.",
  ["x = 5 or x = −3", "x = −5 or x = 3", "x = 15 or x = −1", "x = 3 or x = 5"],
  lambda: "x = 5 or x = −3" if roots(1, -2, -15) == [-3, 5] else None)
q(f"test-{T}-2", T, 3, "If α and β are the roots of x² − 7x + 10 = 0, find 1/α + 1/β.",
  ["7/10", "10/7", "7", "17/10"], lambda: frac(sum(F(1) / F(round(r)) for r in roots(1, -7, 10))))

T = "sequences-series"
q(f"test-{T}-1", T, 2, "Find the 8th term of the arithmetic progression −5, −2, 1, …",
  ["16", "19", "13", "−26"], lambda: str(-5 + 7 * 3))
q(f"test-{T}-2", T, 3, "The sum of the first n terms of an arithmetic progression is n(3n + 1). Find the 5th term.",
  ["28", "80", "16", "52"], lambda: str(5 * (3 * 5 + 1) - 4 * (3 * 4 + 1)))

T = "geometry-mensuration"
q(f"test-{T}-1", T, 2, "Find the area of a circle of diameter 14 cm. [Take π = 22/7]",
  ["154 cm²", "616 cm²", "44 cm²", "308 cm²"], lambda: f"{frac(PI * 7 * 7)} cm²")
q(f"test-{T}-2", T, 3, "A cone has base radius 7 cm and height 24 cm. Find its curved surface area. [Take π = 22/7]",
  ["550 cm²", "528 cm²", "1232 cm²", "704 cm²"], lambda: f"{frac(PI * 7 * math.isqrt(7**2 + 24**2))} cm²")

T = "trigonometry"
q(f"test-{T}-1", T, 2, "If cos θ = 5/13 and θ is acute, find tan θ.",
  ["12/5", "5/12", "12/13", "13/12"], lambda: "12/5" if math.isclose(math.tan(math.acos(5 / 13)), 12 / 5) else None)
q(f"test-{T}-2", T, 3, "From the top of a cliff 50 m high, the angle of depression of a boat is 30°. How far is the boat from the foot of the cliff?",
  ["50√3 m", "50/√3 m", "100 m", "25 m"], lambda: "50√3 m" if math.isclose(50 / math.tan(d(30)), 50 * math.sqrt(3)) else None)

T = "statistics-probability"
q(f"test-{T}-1", T, 2, "Find the median of 3, 8, 5, 9, 6 and 10.",
  ["7", "6", "8", "6.5"], lambda: str(round(sum(sorted([3, 8, 5, 9, 6, 10])[2:4]) / 2)))
q(f"test-{T}-2", T, 3, "Two fair dice are thrown. Find the probability that the sum of the scores is 8.",
  ["5/36", "1/6", "1/9", "2/9"], lambda: frac(F(sum(1 for a in range(1, 7) for b in range(1, 7) if a + b == 8), 36)))

# ---------------- verification against seed-data.ts

SEED = Path(__file__).with_name("seed-data.ts")
SEED_RE = re.compile(
    r'question\("([^"]+)", "([^"]+)", (\d),\s*("(?:[^"\\]|\\.)*"),\s*(\[.*?\]), "([ABCD])"\)', re.S)


def read_seed():
    return {m.group(1): dict(topic=m.group(2), diff=int(m.group(3)), stem=json.loads(m.group(4)),
                             options=json.loads(m.group(5)), answer=m.group(6))
            for m in SEED_RE.finditer(SEED.read_text(encoding="utf-8"))}


def verify():
    problems = []
    seen = set()
    for x in Q:
        if x["id"] in seen:
            problems.append(f"{x['id']}: duplicate id in questions.py")
        seen.add(x["id"])
        got = x["check"]()
        if got is not True and got != x["options"][0]:
            problems.append(f"{x['id']}: check gives {got!r}, but the correct option is {x['options'][0]!r}")
        if len(set(x["options"])) != 4:
            problems.append(f"{x['id']}: options are not four distinct values")

    seed = read_seed()
    by_id = {x["id"]: x for x in Q}
    for qid, s in seed.items():
        x = by_id.get(qid)
        if x is None:
            problems.append(f"{qid}: in seed-data.ts but has no check here")
            continue
        if (s["topic"], s["diff"], s["stem"]) != (x["topic"], x["diff"], x["stem"]):
            problems.append(f"{qid}: topic, difficulty or stem differs from seed-data.ts")
        if sorted(s["options"]) != sorted(x["options"]):
            problems.append(f"{qid}: options differ from seed-data.ts")
        elif s["options"]["ABCD".index(s["answer"])] != x["options"][0]:
            problems.append(f"{qid}: seed-data.ts answer {s['answer']} is "
                            f"{s['options']['ABCD'.index(s['answer'])]!r}, expected {x['options'][0]!r}")
    unseeded = [x["id"] for x in Q if x["id"] not in seed]
    return problems, seed, unseeded


def ts(s):
    return json.dumps(s, ensure_ascii=False)


def emit(seed, unseeded):
    """Print TypeScript for unseeded questions, placing each answer on the least-used letter."""
    key = Counter(s["answer"] for s in seed.values())
    current = None
    for x in (x for x in Q if x["id"] in unseeded):
        letter = min("ABCD", key=lambda l: (key[l], l))
        key[letter] += 1
        opts = x["options"][1:]
        opts.insert("ABCD".index(letter), x["options"][0])
        if x["topic"] != current:
            print(f"\n  // {x['topic']}: paste after its last question")
            current = x["topic"]
        print(f'  question("{x["id"]}", "{x["topic"]}", {x["diff"]},')
        print(f"    {ts(x['stem'])},")
        print(f"    [{', '.join(ts(o) for o in opts)}], \"{letter}\"),")


if __name__ == "__main__":
    problems, seed, unseeded = verify()
    if "--emit" in sys.argv:
        emit(seed, unseeded)
    for p in problems:
        print("PROBLEM", p, file=sys.stderr)
    key = Counter(s["answer"] for s in seed.values())
    print(f"{len(Q)} questions checked, {len(seed)} in seed-data.ts, {len(unseeded)} not yet seeded; "
          f"seeded answer key {dict(sorted(key.items()))}; {len(problems)} problem(s)", file=sys.stderr)
    sys.exit(1 if problems else 0)
