"""
38_proxy_grades.py — Derive sparse attribute grades from well-covered proxy attributes.

Several personality-critical attributes have <10% real coverage (aggression, pressing,
skills, intensity). This script infers reasonable proxy grades from high-coverage
attributes using weighted combinations calibrated to match target distributions.

Source = 'proxy_inferred' — lowest trust, never overwrites real grades.

Usage:
    python 38_proxy_grades.py --dry-run        # preview
    python 38_proxy_grades.py                  # apply
    python 38_proxy_grades.py --force          # overwrite existing proxy grades
    python 38_proxy_grades.py --player 123     # single player
"""
from __future__ import annotations

import argparse
import math
import sys
from collections import defaultdict

import psycopg2

from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="Derive proxy grades for sparse attributes")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--force", action="store_true", help="Overwrite existing proxy grades")
parser.add_argument("--player", type=int, default=None, help="Single person_id")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
SOURCE = "proxy_inferred"

# ── Proxy definitions ────────────────────────────────────────────────────────
# Each target attribute is derived from a weighted combination of source attributes.
# Weight > 0 means positive correlation, < 0 means inverse.
# min_sources: minimum number of source attrs that must exist to produce a proxy.

PROXY_DEFS: dict[str, dict] = {
    "aggression": {
        "sources": {"duels": 3.0, "tackling": 2.5, "discipline": -2.0, "composure": -1.0},
        "min_sources": 2,
    },
    "pressing": {
        "sources": {"duels": 2.5, "tackling": 2.0, "interceptions": 1.5, "awareness": 1.0},
        "min_sources": 2,
    },
    "intensity": {
        "sources": {"duels": 2.0, "tackling": 1.5, "take_ons": 1.5, "carries": 1.0},
        "min_sources": 2,
    },
    "skills": {
        "sources": {"take_ons": 3.0, "creativity": 2.5, "composure": 1.0},
        "min_sources": 2,
    },
    "leadership": {
        "sources": {"discipline": 2.5, "awareness": 2.0, "composure": 1.5, "take_ons": -1.0},
        "min_sources": 2,
    },
    "communication": {
        "sources": {"discipline": 2.0, "awareness": 2.0, "composure": 1.5, "take_ons": -1.0},
        "min_sources": 2,
    },
    "concentration": {
        "sources": {"awareness": 2.5, "discipline": 2.0, "composure": 1.5},
        "min_sources": 2,
    },
    "drive": {
        "sources": {"duels": 2.0, "take_ons": 1.5, "discipline": 1.0},
        "min_sources": 2,
    },
}


def compute_proxy(
    player_grades: dict[str, float],
    sources: dict[str, float],
    target_mean: float,
    target_std: float,
    source_stats: dict[str, dict],
) -> float | None:
    """Compute a proxy grade using z-score normalization.

    1. Z-normalize each source attribute relative to its population distribution.
    2. Compute weighted average of z-scores (inverted sources contribute negative z).
    3. Map the result back to the target attribute's scale using its population stats.
    """
    z_total = 0.0
    w_total = 0.0

    for attr, weight in sources.items():
        grade = player_grades.get(attr)
        if grade is None:
            continue
        stats = source_stats.get(attr)
        if not stats or stats["std"] < 0.5:
            continue

        z = (grade - stats["mean"]) / stats["std"]

        if weight < 0:
            # Inverse correlation: high source grade → low target grade
            z = -z
            weight = abs(weight)

        z_total += z * weight
        w_total += weight

    if w_total == 0:
        return None

    avg_z = z_total / w_total
    # Map z-score to target attribute scale
    result = target_mean + avg_z * target_std
    # Clamp to 1-10 (standardized stat_score scale)
    return max(1.0, min(10.0, round(result, 1)))


# ── Main ──────────────────────────────────────────────────────────────────────

if not POSTGRES_DSN:
    print("ERROR: Set POSTGRES_DSN in .env.local")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

print("38 — Proxy Grade Inference")

# ── Load all attribute grades ────────────────────────────────────────────────
cur.execute("""
    SELECT ag.player_id, ag.attribute,
           MAX(COALESCE(ag.scout_grade, ag.stat_score)) as grade,
           MAX(ag.source) as source
    FROM attribute_grades ag
    WHERE ag.source NOT IN ('eafc', 'ea_fc', 'eafc_inferred')
    GROUP BY ag.player_id, ag.attribute
""")
all_grades: dict[int, dict[str, float]] = defaultdict(dict)
existing_sources: dict[int, dict[str, str]] = defaultdict(dict)
for pid, attr, grade, source in cur.fetchall():
    if grade is not None:
        attr_lower = attr.lower()
        all_grades[pid][attr_lower] = grade
        existing_sources[pid][attr_lower] = source

print(f"  {len(all_grades)} players with attribute data")

# ── Compute per-attribute population stats ───────────────────────────────────
attr_values: dict[str, list[float]] = defaultdict(list)
for pid, pgrades in all_grades.items():
    for attr, grade in pgrades.items():
        attr_values[attr].append(grade)

attr_stats: dict[str, dict[str, float]] = {}
for attr, vals in attr_values.items():
    if len(vals) >= 50:
        mean = sum(vals) / len(vals)
        std = math.sqrt(sum((v - mean) ** 2 for v in vals) / len(vals))
        attr_stats[attr] = {"mean": mean, "std": std}

# Manual fallback stats for ultra-sparse attributes (<50 real grades).
# These are reasonable priors based on the 1-10 stat_score scale.
FALLBACK_STATS = {
    "leadership": {"mean": 4.5, "std": 2.0},
    "communication": {"mean": 4.5, "std": 2.0},
    "concentration": {"mean": 5.0, "std": 2.0},
    "drive": {"mean": 5.0, "std": 2.0},
}
for attr, stats in FALLBACK_STATS.items():
    if attr not in attr_stats:
        attr_stats[attr] = stats

print(f"  {len(attr_stats)} attributes with population stats (incl. {len(FALLBACK_STATS)} fallbacks)")

# ── Find players who need proxy grades ───────────────────────────────────────
# Only process active players with profiles
player_filter = ""
if args.player:
    player_filter = f"AND p.id = {args.player}"

cur.execute(f"""
    SELECT p.id, p.name, pp.position
    FROM people p
    JOIN player_profiles pp ON pp.person_id = p.id
    WHERE p.active = true {player_filter}
    ORDER BY p.name
""")
players = cur.fetchall()
print(f"  {len(players)} active players to check")

# ── Check what proxy grades already exist ────────────────────────────────────
existing_proxy: set[tuple[int, str]] = set()
cur.execute(f"SELECT player_id, attribute FROM attribute_grades WHERE source = '{SOURCE}'")
for pid, attr in cur.fetchall():
    existing_proxy.add((pid, attr.lower()))

# ── Generate proxy grades ────────────────────────────────────────────────────
inserts = []
skipped = 0
already_has = 0

for pid, name, position in players:
    pgrades = all_grades.get(pid, {})
    if len(pgrades) < 5:
        skipped += 1
        continue

    for target_attr, proxy_def in PROXY_DEFS.items():
        # Skip if player already has a real grade for this attribute
        if target_attr in pgrades and existing_sources.get(pid, {}).get(target_attr) != SOURCE:
            already_has += 1
            continue

        # Skip if proxy already exists and not forcing
        if not FORCE and (pid, target_attr) in existing_proxy:
            already_has += 1
            continue

        # Check target attr has population stats
        target_stats = attr_stats.get(target_attr)
        if not target_stats:
            continue

        # Count available source attributes
        available = sum(1 for a in proxy_def["sources"] if a in pgrades)
        if available < proxy_def["min_sources"]:
            continue

        # Compute proxy grade
        grade = compute_proxy(
            pgrades, proxy_def["sources"],
            target_stats["mean"], target_stats["std"],
            attr_stats,
        )
        if grade is None:
            continue

        inserts.append((pid, target_attr, grade, name))

print(f"  {len(inserts)} proxy grades to write")
print(f"  {already_has} already have real/existing grade")
print(f"  {skipped} players skipped (too few grades)")

# ── Write ────────────────────────────────────────────────────────────────────
if DRY_RUN:
    # Show samples per attribute
    from collections import Counter
    attr_counts = Counter(attr for _, attr, _, _ in inserts)
    print(f"\n  Per-attribute breakdown:")
    for attr, count in attr_counts.most_common():
        samples = [(n, g) for p, a, g, n in inserts if a == attr][:5]
        sample_str = ", ".join(f"{n}: {g:.0f}" for n, g in samples)
        print(f"    {attr:20s}: {count:5d} grades  (e.g. {sample_str})")
    print(f"\n  --dry-run: no writes.")
else:
    written = 0
    for pid, attr, grade, name in inserts:
        try:
            cur.execute("""
                INSERT INTO attribute_grades (player_id, attribute, stat_score, source)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (player_id, attribute, source)
                DO UPDATE SET stat_score = EXCLUDED.stat_score
            """, (pid, attr, grade, SOURCE))
            written += 1
        except Exception as e:
            print(f"    ERROR {name} {attr}: {e}")
    print(f"  Written: {written}")

cur.close()
conn.close()
print("Done.")
