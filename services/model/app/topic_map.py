"""WAEC/JAMB topic -> ASSISTments skills, read from ml/topic_skill_map.csv (the Q-matrix)."""

import csv
from pathlib import Path


def read_topic_map(path: Path) -> dict[str, list[str]]:
    """{topic_id: [skill_name, ...]} in file order. Empty if the file doesn't exist."""
    if not path.exists():
        return {}
    mapped: dict[str, list[str]] = {}
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            mapped.setdefault(row["topic_id"].strip(), []).append(row["skill_name"].strip())
    return mapped
