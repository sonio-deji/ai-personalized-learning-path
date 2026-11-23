"""Check topic_skill_map.csv against the ASSISTments data and the trained BKT parameters.

Run from ml/:  python check_topic_skill_map.py

Reports mapped skill names that don't exist in the data (usually a spelling difference),
skills dropped by cleaning (no trained parameters), and topics with no usable skills,
which fall back to the default parameters in the model service.
"""

import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

import pandas as pd

MAP = Path("topic_skill_map.csv")
DATA = Path("data/skill_builder_data_corrected_collapsed.csv")
PARAMS = Path("artifacts/bkt_params.json")

mapped = defaultdict(list)
with MAP.open(newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        mapped[row["topic_id"].strip()].append(row["skill_name"].strip())

in_data = None
if DATA.exists():
    raw = pd.read_csv(DATA, encoding="latin-1", low_memory=False, usecols=["skill_name"])
    in_data = set(raw["skill_name"].dropna().astype(str).str.strip())
else:
    print(f"(no {DATA}: skipping the spelling check)")

trained = set(json.loads(PARAMS.read_text())["skills"]) if PARAMS.exists() else None
if trained is None:
    print(f"(no {PARAMS}: skipping the trained-parameters check)")

problems = 0
for topic, skills in mapped.items():
    usable = [s for s in skills if trained is None or s in trained]
    print(f"\n{topic}: {len(usable)}/{len(skills)} usable")
    for s in skills:
        if in_data is not None and s not in in_data:
            print(f"  NOT IN DATA      {s!r}")
            problems += 1
        elif trained is not None and s not in trained:
            print(f"  no parameters    {s!r} (dropped by cleaning?)")
            problems += 1
    if trained is not None and not usable:
        print("  -> falls back to the default parameters")

if in_data is not None:
    unmapped = sorted(in_data - {s for v in mapped.values() for s in v})
    print(f"\n{len(unmapped)} ASSISTments skills are not mapped to any topic (expected: many are not on the syllabus).")

sys.exit(1 if problems else 0)
