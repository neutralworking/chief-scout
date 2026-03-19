"""
44_career_xp.py — Career XP v2: "The Footballer's Odyssey"

BG3-inspired career event system with 159 milestone types across 10 categories,
rarity tiers, and an exponential XP level curve (1-12).

Detects career milestones from 15+ data sources and writes:
  - player_xp rows (individual milestones with category/rarity/season)
  - player_profiles.xp_modifier (derived from XP level)
  - player_profiles.xp_level (1-12, BG3-style)

Usage:
    python 44_career_xp.py                  # all players with data
    python 44_career_xp.py --player ID      # single player
    python 44_career_xp.py --limit 50       # first 50 players
    python 44_career_xp.py --dry-run        # preview without writing
    python 44_career_xp.py --force          # overwrite existing rows

Requires migrations: 031_career_xp.sql, 037_career_xp_v2.sql
"""
import argparse
import sys
from collections import defaultdict

from supabase import create_client
from config import POSTGRES_DSN, SUPABASE_URL, SUPABASE_SERVICE_KEY

# ── Argument parsing ───────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Career XP v2 — The Footballer's Odyssey")
parser.add_argument("--player", type=str, default=None, help="Single person_id")
parser.add_argument("--limit", type=int, default=None, help="Max players")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--force", action="store_true", help="Overwrite existing rows")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
CHUNK_SIZE = 200

# ── Connections ────────────────────────────────────────────────────────────────

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

if not POSTGRES_DSN:
    print("ERROR: Set POSTGRES_DSN in .env"); sys.exit(1)
if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env"); sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
sb_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ── Import detectors ──────────────────────────────────────────────────────────

# Add parent directory to path for package imports
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))

from pipeline.xp_detectors import ALL_DETECTORS, compute_xp_level, compute_negative_modifier, compute_legacy_score


# ── Data loading ──────────────────────────────────────────────────────────────

def load_all_data(cur, player_ids):
    """Batch-load all data sources into per-player dicts."""
    if not player_ids:
        return {}

    placeholders = ",".join(["%s"] * len(player_ids))
    data = {pid: {"person_id": pid} for pid in player_ids}

    # 1. Career history
    cur.execute(f"""
        SELECT person_id, club_name, club_id, start_date, end_date, is_loan, sort_order
        FROM player_career_history
        WHERE person_id IN ({placeholders})
        ORDER BY person_id, sort_order, start_date
    """, player_ids)
    cols = [d[0] for d in cur.description]
    for row in cur.fetchall():
        d = dict(zip(cols, row))
        data[d["person_id"]].setdefault("career_entries", []).append(d)

    # 2. People (awards, total_goals, dob, nation_id, active)
    cur.execute(f"""
        SELECT id, awards, total_goals, date_of_birth, nation_id, active
        FROM people WHERE id IN ({placeholders})
    """, player_ids)
    cols = [d[0] for d in cur.description]
    for row in cur.fetchall():
        d = dict(zip(cols, row))
        pid = d["id"]
        data[pid]["awards"] = d.get("awards")
        data[pid]["total_goals"] = d.get("total_goals")
        data[pid]["dob"] = d.get("date_of_birth")
        data[pid]["nation_id"] = d.get("nation_id")
        data[pid]["active"] = d.get("active", True)

    # 3. Career metrics
    cur.execute(f"""
        SELECT person_id, trajectory, career_years, clubs_count, loan_count,
               avg_tenure_yrs, max_tenure_yrs, leagues_count
        FROM career_metrics WHERE person_id IN ({placeholders})
    """, player_ids)
    cols = [d[0] for d in cur.description]
    for row in cur.fetchall():
        d = dict(zip(cols, row))
        data[d["person_id"]]["career_metric"] = d

    # 4. Nationality counts
    cur.execute(f"""
        SELECT person_id, COUNT(*) as cnt
        FROM player_nationalities WHERE person_id IN ({placeholders})
        GROUP BY person_id
    """, player_ids)
    for row in cur.fetchall():
        data[row[0]]["nationalities_count"] = row[1]

    # 5. Club data (leagues, capacities, countries)
    cur.execute("SELECT id, league_name, stadium_capacity, nation_id FROM clubs WHERE league_name IS NOT NULL OR stadium_capacity IS NOT NULL")
    club_leagues = {}
    club_capacities = {}
    club_countries = {}
    club_nations = {}
    for row in cur.fetchall():
        cid, league, cap, nid = row
        if league:
            club_leagues[cid] = league
        if cap:
            club_capacities[cid] = cap
        if nid:
            club_countries[cid] = nid
            club_nations[cid] = nid
    for pid in player_ids:
        data[pid]["club_leagues"] = club_leagues
        data[pid]["club_capacities"] = club_capacities
        data[pid]["club_countries"] = club_countries
        data[pid]["club_nations"] = club_nations

    # 6. API-Football stats (per-season) — aggregate by person_id + season
    cur.execute(f"""
        SELECT person_id, season,
               SUM(appearances) as appearances, SUM(minutes) as minutes,
               SUM(goals) as goals, SUM(assists) as assists,
               SUM(shots_total) as shots_total,
               AVG(passes_accuracy) as passes_accuracy,
               SUM(passes_key) as key_passes,
               SUM(tackles_total) as tackles_total,
               SUM(interceptions) as interceptions, SUM(blocks) as blocks,
               SUM(dribbles_success) as dribbles_success,
               SUM(dribbles_attempted) as dribbles_attempts,
               SUM(duels_won) as duels_won, SUM(duels_total) as duels_total,
               AVG(rating) as rating,
               SUM(penalties_scored) as penalty_scored,
               SUM(penalties_missed) as penalty_missed,
               SUM(fouls_drawn) as fouls_drawn,
               SUM(cards_yellow) as yellow_cards,
               SUM(cards_red) as red_cards
        FROM api_football_player_stats
        WHERE person_id IN ({placeholders})
        GROUP BY person_id, season
        ORDER BY person_id, season
    """, player_ids)
    cols = [d[0] for d in cur.description]
    for row in cur.fetchall():
        d = dict(zip(cols, row))
        pid = d.pop("person_id")
        # Convert numeric types
        for k in d:
            if d[k] is not None:
                try:
                    d[k] = float(d[k])
                except (ValueError, TypeError):
                    pass
        data[pid].setdefault("af_seasons", []).append(d)

    # 7. FBRef stats (per-season) — join via player_id_links
    cur.execute(f"""
        SELECT pil.person_id, fs.season, fs.goals, fs.assists,
               fs.progressive_passes, fs.progressive_carries,
               fs.tackles, fs.key_passes, fs.minutes
        FROM fbref_player_season_stats fs
        JOIN player_id_links pil ON pil.external_id = fs.fbref_id
             AND pil.source = 'fbref'
        WHERE pil.person_id IN ({placeholders})
        ORDER BY pil.person_id, fs.season
    """, player_ids)
    cols = [d[0] for d in cur.description]
    for row in cur.fetchall():
        d = dict(zip(cols, row))
        pid = d.pop("person_id")
        data[pid].setdefault("fbref_seasons", []).append(d)

    # 8. Understat stats (per-season, aggregated via match join)
    cur.execute(f"""
        SELECT pil.person_id, um.season,
               SUM(ups.goals) as goals, SUM(ups.xg) as xg,
               SUM(ups.assists) as assists, SUM(ups.xa) as xa,
               SUM(ups.xgchain) as xg_chain, SUM(ups.xgbuildup) as xg_buildup
        FROM understat_player_match_stats ups
        JOIN understat_matches um ON um.id = ups.match_id
        JOIN player_id_links pil ON pil.external_id = ups.player_id::text
             AND pil.source = 'understat'
        WHERE pil.person_id IN ({placeholders})
        GROUP BY pil.person_id, um.season
        ORDER BY pil.person_id, um.season
    """, player_ids)
    cols = [d[0] for d in cur.description]
    for row in cur.fetchall():
        d = dict(zip(cols, row))
        pid = d.pop("person_id")
        # Convert Decimals to float
        for k in ("goals", "xg", "assists", "xa", "xg_chain", "xg_buildup"):
            if d.get(k) is not None:
                d[k] = float(d[k])
        data[pid].setdefault("understat_seasons", []).append(d)

    # 9. Personality
    cur.execute(f"""
        SELECT person_id, ei, sn, tf, jp, competitiveness, coachability
        FROM player_personality WHERE person_id IN ({placeholders})
    """, player_ids)
    cols = [d[0] for d in cur.description]
    for row in cur.fetchall():
        d = dict(zip(cols, row))
        data[d["person_id"]]["personality"] = d

    # 10. Trait scores
    cur.execute(f"""
        SELECT player_id as person_id, trait, category, severity
        FROM player_trait_scores WHERE player_id IN ({placeholders})
    """, player_ids)
    cols = [d[0] for d in cur.description]
    for row in cur.fetchall():
        d = dict(zip(cols, row))
        data[d["person_id"]].setdefault("traits", []).append(d)

    # 11. Injury summary
    cur.execute(f"""
        SELECT person_id, total_injuries, total_days_missed as total_days,
               worst_injury_days as major_days
        FROM player_injury_summary WHERE person_id IN ({placeholders})
    """, player_ids)
    cols = [d[0] for d in cur.description]
    for row in cur.fetchall():
        d = dict(zip(cols, row))
        # Compute major_count: injuries > 90 days
        d["major_count"] = 1 if (d.get("major_days") or 0) >= 90 else 0
        data[d["person_id"]]["injury_summary"] = d

    # 11b. Individual injuries from kaggle_injuries
    cur.execute(f"""
        SELECT person_id, injury_type, days_missed as days_out, season
        FROM kaggle_injuries WHERE person_id IN ({placeholders})
    """, player_ids)
    cols = [d[0] for d in cur.description]
    for row in cur.fetchall():
        d = dict(zip(cols, row))
        data[d["person_id"]].setdefault("injuries", []).append(d)

    # 12. Key moments
    cur.execute(f"""
        SELECT person_id, title, moment_type, moment_date, sentiment
        FROM key_moments WHERE person_id IN ({placeholders})
    """, player_ids)
    cols = [d[0] for d in cur.description]
    for row in cur.fetchall():
        d = dict(zip(cols, row))
        data[d["person_id"]].setdefault("key_moments", []).append(d)

    # 13. News sentiment
    cur.execute(f"""
        SELECT person_id, buzz_score, sentiment_score, trend_7d
        FROM news_sentiment_agg WHERE person_id IN ({placeholders})
    """, player_ids)
    cols = [d[0] for d in cur.description]
    for row in cur.fetchall():
        d = dict(zip(cols, row))
        data[d["person_id"]]["news_sentiment"] = d

    return data


# ── Upsert helpers ─────────────────────────────────────────────────────────────

def chunked_upsert_xp(rows):
    if not rows:
        return 0
    if DRY_RUN:
        print(f"  [dry-run] would upsert {len(rows)} rows into player_xp")
        return len(rows)
    total = 0
    for i in range(0, len(rows), CHUNK_SIZE):
        chunk = rows[i:i + CHUNK_SIZE]
        sb_client.table("player_xp").upsert(
            chunk, on_conflict="person_id,milestone_key"
        ).execute()
        total += len(chunk)
    return total


def update_xp_profiles(modifier_rows):
    """Update xp_modifier + xp_level on player_profiles via psycopg2."""
    if not modifier_rows:
        return 0
    if DRY_RUN:
        print(f"  [dry-run] would update {len(modifier_rows)} xp_modifier/xp_level values")
        return len(modifier_rows)
    cur = conn.cursor()
    psycopg2.extras.execute_batch(cur, """
        UPDATE player_profiles
        SET xp_modifier = %(xp_modifier)s, xp_level = %(xp_level)s, legacy_score = %(legacy_score)s
        WHERE person_id = %(person_id)s
    """, modifier_rows, page_size=500)
    conn.commit() if not conn.autocommit else None
    return len(modifier_rows)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Career XP v2 — The Footballer's Odyssey")
    print(f"  Dry run: {DRY_RUN}")
    print(f"  Force:   {FORCE}")
    print(f"  Detectors: {len(ALL_DETECTORS)}")

    cur = conn.cursor()

    # ── Determine player set ──────────────────────────────────────────────
    if args.player:
        player_ids = [int(args.player)]
    else:
        cur.execute("""
            SELECT DISTINCT id FROM (
                SELECT person_id AS id FROM player_career_history
                UNION SELECT id FROM people WHERE awards IS NOT NULL OR total_goals IS NOT NULL
                UNION SELECT person_id AS id FROM player_personality
                UNION SELECT pil.person_id AS id FROM player_id_links pil
                      WHERE pil.source IN ('api_football', 'fbref', 'understat')
            ) sub
        """)
        player_ids = [r[0] for r in cur.fetchall()]

    if not FORCE and not args.player:
        cur.execute("SELECT DISTINCT person_id FROM player_xp WHERE category IS NOT NULL")
        existing = {r[0] for r in cur.fetchall()}
        player_ids = [pid for pid in player_ids if pid not in existing]

    if args.limit:
        player_ids = player_ids[:args.limit]

    if not player_ids:
        print("  No players to process.")
        cur.close(); conn.close()
        return

    print(f"  Players to process: {len(player_ids)}")

    # ── Batch-load data ───────────────────────────────────────────────────
    print("  Loading data...")
    all_data = load_all_data(cur, player_ids)
    print(f"  Data loaded for {len(all_data)} players")

    # ── Process each player ───────────────────────────────────────────────
    all_xp_rows = []
    modifier_rows = []
    stats = {"processed": 0, "milestones": 0, "positive": 0, "negative": 0}
    level_distribution = defaultdict(int)
    category_counts = defaultdict(int)
    rarity_counts = defaultdict(int)

    for pid in player_ids:
        pd = all_data.get(pid, {"person_id": pid})
        milestones = []

        # Run all detectors
        for detector in ALL_DETECTORS:
            try:
                ms = detector(pd)
                milestones.extend(ms)
            except Exception as e:
                print(f"  WARN: detector {detector.__module__} failed for {pid}: {e}")

        if not milestones:
            continue

        # Deduplicate by milestone_key
        seen_keys = set()
        unique_milestones = []
        for m in milestones:
            key = m["milestone_key"]
            if key not in seen_keys:
                seen_keys.add(key)
                unique_milestones.append(m)
        milestones = unique_milestones

        # Build XP rows
        for m in milestones:
            row = {
                "person_id": pid,
                "milestone_key": m["milestone_key"],
                "milestone_label": m["milestone_label"],
                "xp_value": m["xp_value"],
                "source": m["source"],
                "details": m.get("details"),
                "category": m.get("category"),
                "rarity": m.get("rarity", "common"),
            }
            if m.get("milestone_date"):
                row["milestone_date"] = str(m["milestone_date"])
            if m.get("season"):
                row["season"] = m["season"]
            all_xp_rows.append(row)
            category_counts[m.get("category", "unknown")] += 1
            rarity_counts[m.get("rarity", "common")] += 1

        # Compute XP level + legacy score
        positive_xp = sum(m["xp_value"] for m in milestones if m["xp_value"] > 0)
        negative_xp = abs(sum(m["xp_value"] for m in milestones if m["xp_value"] < 0))
        xp_level, level_modifier, title = compute_xp_level(positive_xp)
        neg_modifier = compute_negative_modifier(negative_xp)
        final_modifier = max(-5, min(8, level_modifier + neg_modifier))
        legacy = compute_legacy_score(milestones)

        modifier_rows.append({
            "person_id": pid,
            "xp_modifier": final_modifier,
            "xp_level": xp_level,
            "legacy_score": legacy,
        })

        stats["processed"] += 1
        stats["milestones"] += len(milestones)
        stats["positive"] += sum(1 for m in milestones if m["xp_value"] > 0)
        stats["negative"] += sum(1 for m in milestones if m["xp_value"] < 0)
        level_distribution[xp_level] += 1

    # ── Sample output ─────────────────────────────────────────────────────
    if all_xp_rows and modifier_rows:
        # Pick a player with many milestones
        pid_counts = defaultdict(int)
        for r in all_xp_rows:
            pid_counts[r["person_id"]] += 1
        sample_pid = max(pid_counts, key=pid_counts.get)
        sample_ms = [r for r in all_xp_rows if r["person_id"] == sample_pid]
        sample_mod = next((r for r in modifier_rows if r["person_id"] == sample_pid), None)

        print(f"\n  Sample (person_id={sample_pid}, {len(sample_ms)} milestones):")
        for m in sorted(sample_ms, key=lambda x: -x["xp_value"]):
            rarity_tag = f"[{m.get('rarity', '?')}]"
            cat_tag = f"({m.get('category', '?')})"
            print(f"    {m['xp_value']:+d}  {rarity_tag:12s} {m['milestone_label']:40s}  {cat_tag}")
        if sample_mod:
            _, _, title = compute_xp_level(
                sum(m["xp_value"] for m in sample_ms if m["xp_value"] > 0)
            )
            print(f"    → Level {sample_mod['xp_level']} ({title}), modifier: {sample_mod['xp_modifier']:+d}, legacy: {sample_mod['legacy_score']}/99")

    # ── Category breakdown ────────────────────────────────────────────────
    print(f"\n  Category breakdown:")
    for cat in sorted(category_counts, key=category_counts.get, reverse=True):
        print(f"    {cat:15s}  {category_counts[cat]:6d}")

    print(f"\n  Rarity breakdown:")
    for r in ["common", "uncommon", "rare", "epic", "legendary", "cursed"]:
        if r in rarity_counts:
            print(f"    {r:12s}  {rarity_counts[r]:6d}")

    # ── Level distribution ────────────────────────────────────────────────
    from pipeline.xp_detectors import XP_LEVELS
    level_titles = {lv: name for lv, _, _, name in XP_LEVELS}

    print(f"\n  XP Level distribution:")
    for lv in sorted(level_distribution.keys()):
        title = level_titles.get(lv, "?")
        bar = "#" * min(level_distribution[lv], 50)
        print(f"    Lv{lv:2d} ({title:14s})  {level_distribution[lv]:5d}  {bar}")

    # ── Write ─────────────────────────────────────────────────────────────
    n_xp = chunked_upsert_xp(all_xp_rows)
    n_mod = update_xp_profiles(modifier_rows)

    print(f"\n── Summary ───────────────────────────────────────────────────────")
    print(f"  Players processed:  {stats['processed']}")
    print(f"  Milestones found:   {stats['milestones']} (+{stats['positive']} / -{stats['negative']})")
    print(f"  XP rows upserted:   {n_xp}")
    print(f"  Profiles updated:   {n_mod}")
    if DRY_RUN:
        print("  (dry-run — no data was written)")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
