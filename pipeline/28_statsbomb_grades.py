"""
28_statsbomb_grades.py — Derive attribute_grades from StatsBomb open data events.

Processes match events (tackles, interceptions, pressures, clearances, blocks,
dribbles, aerial duels) directly from the StatsBomb API, computing per-90 stats
and converting to 0-10 SACROSANCT scale via percentile ranking.

This fills the critical defensive data gap that Understat can't cover:
  - Destroyer: tackling, blocking, clearances
  - Cover: interceptions, awareness (tackles+interceptions)
  - Dribbler: take_ons, carries
  - Target: aerial_duels
  - Powerhouse: duels, aggression (fouls committed)
  - Engine: pressing

Usage:
    python 28_statsbomb_grades.py                     # all available data
    python 28_statsbomb_grades.py --competition 2     # La Liga only
    python 28_statsbomb_grades.py --min-minutes 270   # 3+ full matches
    python 28_statsbomb_grades.py --dry-run
"""
from __future__ import annotations

import argparse
import sys
from collections import defaultdict

from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="StatsBomb events → attribute grades")
parser.add_argument("--competition", type=int, default=None, help="Single competition ID")
parser.add_argument("--min-minutes", type=int, default=270, help="Minimum minutes (default: 270 = 3 matches)")
parser.add_argument("--dry-run", action="store_true")
args = parser.parse_args()

DRY_RUN = args.dry_run
MIN_MINUTES = args.min_minutes


# ── SACROSANCT attribute mapping ─────────────────────────────────────────────
# StatsBomb event type → SACROSANCT attribute
SB_TO_SACROSANCT = {
    "tackles_won":     "tackling",       # Destroyer
    "interceptions":   "interceptions",  # Cover
    "blocks":          "blocking",       # Destroyer
    "clearances":      "clearances",     # Destroyer
    "pressures":       "pressing",       # Engine
    "dribbles_won":    "take_ons",       # Dribbler
    "carries":         "carries",        # Dribbler
    "aerial_won":      "aerial_duels",   # Target
    "duels_won":       "duels",          # Powerhouse
    "fouls_committed": "aggression",     # Powerhouse (proxy)
    "def_actions":     "awareness",      # Cover (tackles + interceptions combined)
}


def main():
    import psycopg2
    import psycopg2.extras
    from psycopg2.extras import execute_values

    print("28 — StatsBomb Events → Attribute Grades")

    # ── Get match list from our DB ───────────────────────────────────────
    conn = psycopg2.connect(POSTGRES_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    comp_filter = ""
    comp_params = []
    if args.competition:
        comp_filter = "AND m.competition_id = %s"
        comp_params = [args.competition]

    cur.execute(f"""
        SELECT m.match_id, m.competition_id, c.competition_name, c.season_name
        FROM sb_matches m
        JOIN sb_competitions c ON c.competition_id = m.competition_id AND c.season_id = m.season_id
        {comp_filter}
        ORDER BY m.competition_id, m.match_id
    """, comp_params)
    matches = cur.fetchall()
    print(f"  {len(matches):,} matches in DB")

    # ── Process events from StatsBomb API ────────────────────────────────
    from statsbombpy import sb
    import warnings
    warnings.filterwarnings("ignore", message="credentials were not supplied")

    # Accumulate per-player stats (single pass — no re-scan)
    def _new_stats():
        return {
            "match_count": 0,
            "tackles_won": 0, "interceptions": 0, "blocks": 0, "clearances": 0,
            "pressures": 0, "dribbles_won": 0, "carries": 0,
            "aerial_won": 0, "duels_won": 0, "fouls_committed": 0,
            "_matches": set(),
        }

    player_stats: dict[str, dict] = defaultdict(_new_stats)

    processed = 0
    skipped = 0
    for i, match in enumerate(matches):
        mid = match["match_id"]
        if (i + 1) % 100 == 0 or i == 0:
            print(f"  Processing match {i+1}/{len(matches)} ({match['competition_name']} {match['season_name']})...", end="\r")

        try:
            events = sb.events(match_id=mid)
        except Exception:
            skipped += 1
            continue

        if events.empty:
            skipped += 1
            continue

        processed += 1

        # Track which players appear in this match + count events
        for _, ev in events.iterrows():
            player = ev.get("player")
            if not player or str(player) == "nan":
                continue

            pid = str(player)
            ps = player_stats[pid]

            # Track match appearances (for minutes estimation)
            if mid not in ps["_matches"]:
                ps["_matches"].add(mid)
                ps["match_count"] += 1

            etype = ev.get("type", "")

            if etype == "Duel":
                outcome = ev.get("duel_outcome", "")
                duel_type = ev.get("duel_type", "")
                is_won = outcome in ("Won", "Success", "Success In Play", "Success Out")
                if is_won:
                    ps["duels_won"] += 1
                if "Aerial" in duel_type and is_won:
                    ps["aerial_won"] += 1
                if duel_type == "Tackle" and is_won:
                    ps["tackles_won"] += 1
            elif etype == "Interception":
                ps["interceptions"] += 1
            elif etype == "Block":
                ps["blocks"] += 1
            elif etype == "Clearance":
                ps["clearances"] += 1
            elif etype == "Pressure":
                ps["pressures"] += 1
            elif etype == "Dribble":
                if ev.get("dribble_outcome") == "Complete":
                    ps["dribbles_won"] += 1
            elif etype == "Carry":
                ps["carries"] += 1
            elif etype == "Foul Committed":
                ps["fouls_committed"] += 1

    print(f"\n  Processed {processed:,} matches, skipped {skipped:,}")
    print(f"  {len(player_stats):,} unique players found")

    # ── Compute per-90 stats ─────────────────────────────────────────────
    # Estimate minutes from match appearances (tracked during event processing)
    qualifying = {}
    for pid, ps in player_stats.items():
        n_matches = ps.get("match_count", 0)
        est_minutes = n_matches * 70  # conservative: avg 70 min per appearance
        if est_minutes < MIN_MINUTES:
            continue
        per90 = {}
        for stat in ["tackles_won", "interceptions", "blocks", "clearances",
                      "pressures", "dribbles_won", "carries", "aerial_won",
                      "duels_won", "fouls_committed"]:
            per90[stat] = ps[stat] / est_minutes * 90 if est_minutes > 0 else 0
        per90["def_actions"] = per90["tackles_won"] + per90["interceptions"]
        qualifying[pid] = per90

    print(f"  {len(qualifying):,} players qualifying ({MIN_MINUTES}+ estimated minutes)")

    if not qualifying:
        print("  No qualifying players. Done.")
        conn.close()
        return

    # ── Percentile ranking within all players ────────────────────────────
    metrics = list(SB_TO_SACROSANCT.keys())
    scores: dict[str, dict[str, int]] = defaultdict(dict)

    for metric in metrics:
        vals = [(pid, qualifying[pid].get(metric, 0)) for pid in qualifying]
        vals.sort(key=lambda x: x[1])
        n = len(vals)
        for rank, (pid, _) in enumerate(vals):
            pct = (rank / max(n - 1, 1)) * 100
            score = max(1, min(10, round(pct / 10)))
            sacrosanct_attr = SB_TO_SACROSANCT[metric]
            scores[pid][sacrosanct_attr] = score

    # ── Match StatsBomb player names to people ───────────────────────────
    print("  Matching StatsBomb players to people...")
    cur.execute("SELECT external_id, person_id FROM player_id_links WHERE source = 'statsbomb'")
    sb_links = {row["external_id"]: row["person_id"] for row in cur.fetchall()}

    # Also try direct name matching
    cur.execute("SELECT id, name FROM people")
    people_by_name: dict[str, int] = {}
    for row in cur.fetchall():
        people_by_name[row["name"].lower().strip()] = row["id"]

    matched = 0
    grades_to_write: list[tuple] = []

    for pid, attrs in scores.items():
        # Try link table first
        person_id = sb_links.get(pid)
        # Fall back to name match
        if not person_id:
            person_id = people_by_name.get(pid.lower().strip())
        if not person_id:
            continue

        matched += 1
        for attr, score in attrs.items():
            grades_to_write.append((person_id, attr, score))

    print(f"  {matched:,} players matched to people")
    print(f"  {len(grades_to_write):,} attribute grades to write")

    if DRY_RUN:
        # Show sample
        if grades_to_write:
            sample_pid = grades_to_write[0][0]
            sample_name = next((pid for pid in scores if people_by_name.get(pid.lower().strip()) == sample_pid or sb_links.get(pid) == sample_pid), "?")
            print(f"\n  Sample ({sample_name}):")
            for person_id, attr, score in grades_to_write:
                if person_id == sample_pid:
                    print(f"    {attr:<20} {score:>2}/10")
        print("\n--dry-run: no writes.")
        conn.rollback()
        conn.close()
        return

    # ── Write grades ─────────────────────────────────────────────────────
    print("  Clearing old statsbomb grades...")
    cur.execute("DELETE FROM attribute_grades WHERE source = 'statsbomb'")
    deleted = cur.rowcount
    print(f"  Deleted {deleted:,} old rows")

    print("  Writing new grades...")
    BATCH = 2000
    for i in range(0, len(grades_to_write), BATCH):
        batch = grades_to_write[i:i + BATCH]
        execute_values(cur, """
            INSERT INTO attribute_grades (player_id, attribute, stat_score, source)
            VALUES %s
            ON CONFLICT (player_id, attribute, source) DO UPDATE SET
                stat_score = EXCLUDED.stat_score
        """, [(pid, attr, score, "statsbomb") for pid, attr, score in batch])

    conn.commit()
    print(f"\nDone. {len(grades_to_write):,} grades written for {matched:,} players.")
    conn.close()


if __name__ == "__main__":
    main()
