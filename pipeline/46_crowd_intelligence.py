"""
46_crowd_intelligence.py — Crowd Intelligence Feedback Loop.

Analyses Gaffer vote data to surface where the crowd disagrees with DB ratings.
Read-only from votes, write-only to analytics tables (fc_matchup_stats, fc_crowd_mismatches).
NEVER writes to player_profiles, attribute_grades, or any rating table.

Algorithm:
1. Query fc_votes joined with fc_options — extract all pairs where both options have person_id
2. For each (player_a, player_b) pair (normalized a < b), count who won
3. Compute per-player crowd win % across all their matchups (min N matchups)
4. Compare crowd percentile rank vs player_profiles.level percentile rank
5. Upsert into fc_matchup_stats and fc_crowd_mismatches

Usage:
    python 46_crowd_intelligence.py --dry-run           # preview
    python 46_crowd_intelligence.py                     # compute + upsert
    python 46_crowd_intelligence.py --min-matchups 5    # lower threshold
    python 46_crowd_intelligence.py --force             # recompute all
"""
import argparse
import sys
from collections import defaultdict

import psycopg2
from psycopg2.extras import execute_values
from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="Crowd Intelligence — vote analysis")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--min-matchups", type=int, default=10, help="Minimum matchups per player (default: 10)")
parser.add_argument("--force", action="store_true", help="Recompute all (clear existing)")
args = parser.parse_args()

if not POSTGRES_DSN:
    print("ERROR: Set POSTGRES_DSN in .env.local")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

# ── Step 1: Extract head-to-head pairs from static votes ──────────────────────
# For each question, find all pairs of options that both have a person_id,
# then see which person was voted for more.

print("Step 1: Extracting head-to-head matchups from static votes...")

cur.execute("""
    SELECT v.question_id, v.chosen_option_id, o.person_id
    FROM fc_votes v
    JOIN fc_options o ON o.id = v.chosen_option_id
    WHERE o.person_id IS NOT NULL
""")
static_votes = cur.fetchall()

# Group votes by question
votes_by_question: dict[int, list[tuple[int, int]]] = defaultdict(list)
for q_id, opt_id, person_id in static_votes:
    votes_by_question[q_id].append((opt_id, person_id))

# For each question, get all options with person_id
cur.execute("""
    SELECT q.id, o.id, o.person_id
    FROM fc_questions q
    JOIN fc_options o ON o.question_id = q.id
    WHERE o.person_id IS NOT NULL
""")
options_by_question: dict[int, list[tuple[int, int]]] = defaultdict(list)
for q_id, opt_id, person_id in cur.fetchall():
    options_by_question[q_id].append((opt_id, person_id))

# Build matchup counts: (player_a, player_b) -> {a_wins, b_wins, total}
# Normalize so player_a < player_b
matchups: dict[tuple[int, int], dict[str, int]] = defaultdict(lambda: {"a_wins": 0, "b_wins": 0, "total": 0})

for q_id, votes in votes_by_question.items():
    q_options = options_by_question.get(q_id, [])
    if len(q_options) < 2:
        continue

    # Get person_ids for this question's options
    opt_to_person = {opt_id: pid for opt_id, pid in q_options}
    person_ids = list(set(opt_to_person.values()))
    if len(person_ids) < 2:
        continue

    # Count votes per person in this question
    person_vote_count: dict[int, int] = defaultdict(int)
    for opt_id, person_id in votes:
        person_vote_count[person_id] += 1

    # For each pair of persons in this question, the one with more votes "wins"
    for i in range(len(person_ids)):
        for j in range(i + 1, len(person_ids)):
            a, b = sorted((person_ids[i], person_ids[j]))
            a_votes = person_vote_count.get(a, 0)
            b_votes = person_vote_count.get(b, 0)
            if a_votes == 0 and b_votes == 0:
                continue
            key = (a, b)
            matchups[key]["total"] += 1
            if a_votes > b_votes:
                matchups[key]["a_wins"] += 1
            elif b_votes > a_votes:
                matchups[key]["b_wins"] += 1
            # ties don't count as a win for either

# ── Step 1b: Include dynamic votes ───────────────────────────────────────────

print("Step 1b: Including dynamic vote matchups...")

cur.execute("""
    SELECT chosen_person_id, opponent_ids
    FROM fc_dynamic_votes
    WHERE chosen_person_id IS NOT NULL AND opponent_ids IS NOT NULL
""")
dynamic_votes = cur.fetchall()

for chosen_id, opponent_ids in dynamic_votes:
    if not opponent_ids:
        continue
    for opp_id in opponent_ids:
        if opp_id == chosen_id:
            continue
        a, b = sorted((chosen_id, opp_id))
        key = (a, b)
        matchups[key]["total"] += 1
        if chosen_id == a:
            matchups[key]["a_wins"] += 1
        else:
            matchups[key]["b_wins"] += 1

print(f"  Found {len(matchups)} unique matchup pairs")

# ── Step 2: Upsert matchup stats ─────────────────────────────────────────────

if not args.dry_run:
    if args.force:
        print("Force mode: clearing existing matchup stats...")
        cur.execute("DELETE FROM fc_matchup_stats")
        cur.execute("DELETE FROM fc_crowd_mismatches")

    print("Step 2: Upserting matchup stats...")
    rows = [
        (a, b, m["total"], m["a_wins"], m["b_wins"])
        for (a, b), m in matchups.items()
    ]
    if rows:
        execute_values(cur, """
            INSERT INTO fc_matchup_stats (player_a_id, player_b_id, total_matchups, player_a_wins, player_b_wins, last_computed)
            VALUES %s
            ON CONFLICT (player_a_id, player_b_id) DO UPDATE SET
                total_matchups = EXCLUDED.total_matchups,
                player_a_wins = EXCLUDED.player_a_wins,
                player_b_wins = EXCLUDED.player_b_wins,
                last_computed = now()
        """, rows, template="(%s, %s, %s, %s, %s, now())")
    print(f"  Upserted {len(rows)} matchup rows")
else:
    print(f"  [dry-run] Would upsert {len(matchups)} matchup rows")

# ── Step 3: Compute per-player crowd win % ───────────────────────────────────

print("Step 3: Computing per-player crowd win percentages...")

player_wins: dict[int, int] = defaultdict(int)
player_total: dict[int, int] = defaultdict(int)

for (a, b), m in matchups.items():
    if m["total"] == 0:
        continue
    player_total[a] += m["total"]
    player_total[b] += m["total"]
    player_wins[a] += m["a_wins"]
    player_wins[b] += m["b_wins"]

# Filter to players with enough matchups
qualified = {
    pid: (player_wins[pid] / player_total[pid] * 100)
    for pid in player_total
    if player_total[pid] >= args.min_matchups
}

print(f"  {len(qualified)} players with >= {args.min_matchups} matchups")

if not qualified:
    print("  No players meet the minimum matchup threshold. Done.")
    cur.close()
    conn.close()
    sys.exit(0)

# ── Step 4: Compare crowd percentile vs DB level percentile ──────────────────

print("Step 4: Computing crowd vs DB mismatches...")

# Get DB levels and overall scores
person_ids = list(qualified.keys())
cur.execute("""
    SELECT pp.person_id, pp.level, pp.overall
    FROM player_profiles pp
    WHERE pp.person_id = ANY(%s) AND pp.level IS NOT NULL
""", (person_ids,))
db_data = {row[0]: {"level": row[1], "overall": row[2]} for row in cur.fetchall()}

# Compute percentile ranks for crowd win %
sorted_crowd = sorted(qualified.items(), key=lambda x: x[1])
crowd_percentiles = {}
n = len(sorted_crowd)
for rank, (pid, win_pct) in enumerate(sorted_crowd):
    crowd_percentiles[pid] = (rank / max(n - 1, 1)) * 100

# Compute percentile ranks for DB level
db_levels = [(pid, db_data[pid]["level"]) for pid in qualified if pid in db_data and db_data[pid]["level"] is not None]
db_levels.sort(key=lambda x: x[1])
db_percentiles = {}
n_db = len(db_levels)
for rank, (pid, lvl) in enumerate(db_levels):
    db_percentiles[pid] = (rank / max(n_db - 1, 1)) * 100

# Compute mismatches
mismatches = []
for pid in qualified:
    if pid not in db_percentiles:
        continue
    crowd_pct = crowd_percentiles[pid]
    db_pct = db_percentiles[pid]
    diff = crowd_pct - db_pct
    mismatch_score = abs(diff)

    if mismatch_score < 10:
        continue  # not significant enough

    direction = "crowd_higher" if diff > 0 else "crowd_lower"
    mismatches.append({
        "person_id": pid,
        "crowd_win_pct": round(qualified[pid], 2),
        "db_level": db_data[pid]["level"],
        "db_overall": db_data[pid].get("overall"),
        "mismatch_score": round(mismatch_score, 2),
        "direction": direction,
        "sample_size": player_total[pid],
    })

mismatches.sort(key=lambda x: x["mismatch_score"], reverse=True)
print(f"  Found {len(mismatches)} significant mismatches (>10 percentile point diff)")

if args.dry_run:
    print("\n── Top 20 Mismatches (dry-run) ──")
    for m in mismatches[:20]:
        print(f"  person_id={m['person_id']} | crowd_win={m['crowd_win_pct']:.1f}% | "
              f"db_level={m['db_level']} | mismatch={m['mismatch_score']:.1f} | "
              f"{m['direction']} | n={m['sample_size']}")
else:
    # ── Step 5: Upsert mismatches ─────────────────────────────────────────────
    print("Step 5: Upserting crowd mismatches...")
    rows = [
        (m["person_id"], m["crowd_win_pct"], m["db_level"], m["db_overall"],
         m["mismatch_score"], m["direction"], m["sample_size"])
        for m in mismatches
    ]
    if rows:
        execute_values(cur, """
            INSERT INTO fc_crowd_mismatches (person_id, crowd_win_pct, db_level, db_overall, mismatch_score, direction, sample_size, computed_at)
            VALUES %s
            ON CONFLICT (person_id) DO UPDATE SET
                crowd_win_pct = EXCLUDED.crowd_win_pct,
                db_level = EXCLUDED.db_level,
                db_overall = EXCLUDED.db_overall,
                mismatch_score = EXCLUDED.mismatch_score,
                direction = EXCLUDED.direction,
                sample_size = EXCLUDED.sample_size,
                computed_at = now()
        """, rows, template="(%s, %s, %s, %s, %s, %s, %s, now())")
    print(f"  Upserted {len(rows)} mismatch rows")

# ── Summary ──────────────────────────────────────────────────────────────────

print(f"\n── Summary ──")
print(f"  Matchup pairs:       {len(matchups)}")
print(f"  Qualified players:   {len(qualified)}")
print(f"  Mismatches detected: {len(mismatches)}")
if mismatches:
    higher = sum(1 for m in mismatches if m["direction"] == "crowd_higher")
    lower = sum(1 for m in mismatches if m["direction"] == "crowd_lower")
    print(f"    Crowd says higher: {higher}")
    print(f"    Crowd says lower:  {lower}")
if args.dry_run:
    print("  (dry-run — no data was written)")

cur.close()
conn.close()
print("Done.")
