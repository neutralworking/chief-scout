"""
85_scout_insights.py — Detect hidden gems and generate scout intelligence notes.

Surfaces players with strong stats but low level/valuation, enriched with context
(homegrown, young, loan, rising trajectory) and Gemini-generated prose.

Usage:
    python 85_scout_insights.py                          # full run
    python 85_scout_insights.py --dry-run --skip-prose   # preview detections
    python 85_scout_insights.py --limit 50               # top 50 only
    python 85_scout_insights.py --skip-prose              # no LLM calls
    python 85_scout_insights.py --season 2025
    python 85_scout_insights.py --force                   # overwrite existing
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import date, datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))

from lib.db import require_conn, get_dict_cursor
from lib.grades import get_position_group, percentile_rank, per90

# ── Args ──────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Scout insights — hidden gem detection + prose")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--force", action="store_true", help="Overwrite existing insights")
parser.add_argument("--limit", type=int, default=100, help="Max insights to generate (default: 100)")
parser.add_argument("--skip-prose", action="store_true", help="Skip Gemini prose generation")
parser.add_argument("--season", default="2025", help="Season year (default: 2025)")
parser.add_argument("--min-minutes", type=int, default=450, help="Minimum minutes (default: 450)")
args = parser.parse_args()

DRY_RUN = args.dry_run
SEASON = args.season
MIN_MINUTES = args.min_minutes

TOP_5_LEAGUES = {"Premier League", "La Liga", "Bundesliga", "Serie A", "Ligue 1"}


def compute_age(dob_str) -> int | None:
    if not dob_str:
        return None
    try:
        dob = date.fromisoformat(str(dob_str)[:10])
        today = date.today()
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    except (ValueError, TypeError):
        return None


def main():
    conn = require_conn()
    cur = get_dict_cursor(conn)

    print(f"85 — Scout Insights (Hidden Gems)")
    print(f"  Season: {SEASON}, min minutes: {MIN_MINUTES}")
    print(f"  Mode: {'DRY RUN' if DRY_RUN else 'LIVE'}")

    # ── Phase 1: Load data ──────────────────────────────────────────────────

    cur.execute("""
        SELECT
            s.person_id, s.minutes, s.appearances, s.rating,
            s.goals, s.assists, s.shots_total, s.shots_on,
            s.passes_key, s.tackles_total, s.dribbles_success,
            s.dribbles_attempted, s.league_name,
            pic.level, pic.overall, pic.position, pic.club, pic.nation,
            pic.nation_code, pic.hg, pic.pursuit_status, pic.market_value_eur,
            pic.best_role_score, pic.fingerprint, pic.name, pic.best_role,
            pe.date_of_birth, pe.contract_expiry_date, pe.active,
            cm.trajectory, cm.loan_count
        FROM api_football_player_stats s
        JOIN player_intelligence_card pic ON pic.person_id = s.person_id
        JOIN people pe ON pe.id = s.person_id
        LEFT JOIN career_metrics cm ON cm.person_id = s.person_id
        WHERE s.season = %s
          AND s.person_id IS NOT NULL
          AND s.minutes >= %s
          AND pe.active = true
    """, (SEASON, MIN_MINUTES))

    players = cur.fetchall()
    print(f"  Loaded {len(players)} players with >= {MIN_MINUTES} min")

    if not players:
        print("  No data to process.")
        conn.close()
        return

    # Load existing tags for HG/Buy Low context
    cur.execute("""
        SELECT pt.player_id, t.tag_name
        FROM player_tags pt
        JOIN tags t ON t.id = pt.tag_id
        WHERE t.tag_name IN ('Hidden Gem', 'Buy Low')
    """)
    tagged_players = defaultdict(set)
    for row in cur.fetchall():
        tagged_players[row["player_id"]].add(row["tag_name"])

    # Load loan status
    cur.execute("SELECT person_id, loan_status FROM player_status WHERE loan_status IS NOT NULL AND loan_status != ''")
    loan_status = {row["person_id"]: row["loan_status"] for row in cur.fetchall()}

    # ── Phase 2: Compute league-position percentiles ────────────────────────

    # Compute per-90 metrics
    player_data = {}
    for p in players:
        pid = p["person_id"]
        mins = p["minutes"]
        pos_group = get_position_group(p["position"]) or "midfielder"

        metrics = {
            "goals_p90": per90(p["goals"], mins),
            "assists_p90": per90(p["assists"], mins),
            "key_passes_p90": per90(p["passes_key"], mins),
            "tackles_p90": per90(p["tackles_total"], mins),
            "dribbles_p90": per90(p["dribbles_success"], mins),
            "rating": float(p["rating"]) if p["rating"] else None,
        }

        player_data[pid] = {
            **{k: v for k, v in dict(p).items()},
            "pos_group": pos_group,
            "age": compute_age(p["date_of_birth"]),
            "metrics": metrics,
            "on_loan": bool(loan_status.get(pid)),
            "has_gem_tag": "Hidden Gem" in tagged_players.get(pid, set()),
            "has_buy_low_tag": "Buy Low" in tagged_players.get(pid, set()),
        }

    # Group by (league, position_group) for percentile computation
    METRIC_NAMES = ["goals_p90", "assists_p90", "key_passes_p90", "tackles_p90", "dribbles_p90", "rating"]

    # league+position pools
    league_pos_pools: dict[tuple[str, str], list[int]] = defaultdict(list)
    # global position pools (fallback)
    global_pos_pools: dict[str, list[int]] = defaultdict(list)

    for pid, pd in player_data.items():
        league = pd.get("league_name") or "Unknown"
        pg = pd["pos_group"]
        league_pos_pools[(league, pg)].append(pid)
        global_pos_pools[pg].append(pid)

    MIN_POOL = 10
    player_percentiles: dict[int, dict[str, float]] = defaultdict(dict)

    for metric in METRIC_NAMES:
        # Try league+position pool first
        for (league, pg), pids in league_pos_pools.items():
            pool_pids = pids if len(pids) >= MIN_POOL else global_pos_pools.get(pg, [])
            if len(pool_pids) < MIN_POOL:
                continue
            values = [(pid, player_data[pid]["metrics"].get(metric)) for pid in pool_pids]
            ranks = percentile_rank(values)
            for pid in pids:
                if pid in ranks:
                    player_percentiles[pid][metric] = ranks[pid]

    print(f"  Computed percentiles for {len(player_percentiles)} players")

    # ── Phase 3: Detect insights (7 detectors) ─────────────────────────────

    # League median market values
    league_values: dict[str, list[float]] = defaultdict(list)
    for pd in player_data.values():
        mv = pd.get("market_value_eur")
        league = pd.get("league_name") or "Unknown"
        if mv and mv > 0:
            league_values[league].append(mv)
    league_medians = {}
    for league, vals in league_values.items():
        vals.sort()
        mid = len(vals) // 2
        league_medians[league] = vals[mid] if vals else 0

    candidates = []

    for pid, pd in player_data.items():
        pcts = player_percentiles.get(pid, {})
        if not pcts:
            continue

        avg_pct = sum(pcts.values()) / len(pcts) if pcts else 0
        level = pd.get("level") or 0
        age = pd.get("age")
        league = pd.get("league_name") or ""
        mv = pd.get("market_value_eur") or 0
        league_median = league_medians.get(league, 0)
        trajectory = pd.get("trajectory") or ""
        rating = pd.get("rating")
        rating_f = float(rating) if rating else 0
        apps = pd.get("appearances") or 0
        contract_exp = pd.get("contract_expiry_date")
        hg = pd.get("hg") or False
        nation = pd.get("nation") or ""
        on_loan = pd.get("on_loan", False)

        flags = []
        context_bonus = 0

        # Detector 1: stat_value_gap (CORE — required)
        has_gap = avg_pct > 75 and (level < 78 or (mv > 0 and mv < league_median))
        if not has_gap:
            continue

        # Detector 2: young_upstep
        if age is not None and age < 23 and avg_pct > 60 and league not in TOP_5_LEAGUES:
            flags.append("young_upstep")
            context_bonus += 15

        # Detector 3: homegrown_abroad
        if hg and league not in TOP_5_LEAGUES:
            flags.append("homegrown_abroad")
            context_bonus += 15

        # Detector 4: loan_performer
        if on_loan and avg_pct > 60:
            flags.append("loan_performer")
            context_bonus += 10

        # Detector 5: rising_trajectory
        if trajectory == "rising" and rating_f >= 6.8:
            flags.append("rising_trajectory")
            context_bonus += 10

        # Detector 6: contract_opportunity
        if contract_exp:
            try:
                exp_date = date.fromisoformat(str(contract_exp)[:10])
                months_left = (exp_date.year - date.today().year) * 12 + (exp_date.month - date.today().month)
                if months_left < 12 and avg_pct > 50 and level < 80:
                    flags.append("contract_opportunity")
                    context_bonus += 10
            except (ValueError, TypeError):
                pass

        # Detector 7: grade_mismatch (supporting — just note it)
        # Check if stat percentiles significantly exceed level
        if avg_pct > 80 and level < 72:
            flags.append("grade_mismatch")

        # ── Phase 4: Gem score ──────────────────────────────────────────────

        stat_outlier_pct = min(avg_pct, 100)
        value_gap_score = 0
        if level < 78:
            value_gap_score = min((78 - level) * 5, 100)
        elif mv > 0 and league_median > 0:
            value_gap_score = min((1 - mv / league_median) * 100, 100)

        # Cap context bonus at 40, then scale to 0-100
        context_scaled = min(context_bonus, 40) / 40 * 100

        # Confidence from appearances
        confidence = min(apps / 20, 1) * 100

        gem_score = (
            stat_outlier_pct * 0.40
            + value_gap_score * 0.25
            + context_scaled * 0.20
            + confidence * 0.15
        )

        # Skip very low gem scores
        if gem_score < 30:
            continue

        # Skip elite players (sanity check)
        if level and level > 85:
            continue

        mins = pd["minutes"]
        goals_p90 = per90(pd["goals"], mins)
        assists_p90 = per90(pd["assists"], mins)

        evidence = {
            "avg_percentile": round(avg_pct, 1),
            "stat_percentiles": {k: round(v, 1) for k, v in pcts.items()},
            "goals_p90": round(goals_p90, 2) if goals_p90 else 0,
            "assists_p90": round(assists_p90, 2) if assists_p90 else 0,
            "rating": round(rating_f, 2) if rating_f else None,
            "appearances": apps,
            "minutes": mins,
            "level": level,
            "market_value_eur": mv,
            "league_median_value": league_median,
            "flags": flags,
            "age": age,
            "position": pd.get("position"),
            "club": pd.get("club"),
            "league": league,
            "nation": nation,
            "nation_code": pd.get("nation_code"),
            "hg": hg,
            "on_loan": on_loan,
            "trajectory": trajectory,
            "best_role": pd.get("best_role"),
            "fingerprint": pd.get("fingerprint"),
        }

        candidates.append({
            "person_id": pid,
            "name": pd.get("name"),
            "gem_score": round(gem_score, 2),
            "evidence": evidence,
            "flags": flags,
        })

    # Sort by gem_score descending, take top N
    candidates.sort(key=lambda c: c["gem_score"], reverse=True)
    candidates = candidates[:args.limit]

    print(f"\n  Detected {len(candidates)} hidden gem candidates")

    if not candidates:
        print("  No candidates found.")
        conn.close()
        return

    # Show top candidates
    for i, c in enumerate(candidates[:15]):
        ev = c["evidence"]
        flag_str = " ".join(f"[{f}]" for f in c["flags"]) if c["flags"] else ""
        print(f"    {i+1:>3}. {c['name']:30s}  gem={c['gem_score']:5.1f}  "
              f"L={ev['level']:>2}  avg_pct={ev['avg_percentile']:4.1f}  "
              f"G/90={ev['goals_p90']:.2f}  Rtg={ev.get('rating') or 0:.1f}  "
              f"{ev['club'] or ''} ({ev['league']})  {flag_str}")

    # ── Phase 5: Prose via Gemini Flash ─────────────────────────────────────

    if not args.skip_prose:
        from lib.llm_router import LLMRouter
        router = LLMRouter(verbose=True)

        SYSTEM_PROMPT = (
            "You are a laconic football scout writing brief intelligence notes for a Director of Football. "
            "Given player data, write a SHORT headline (5-8 words) and 2-3 sentences of analysis. "
            "Be specific about stats. Sound like a real scout, not a journalist. "
            "Format: first line is headline, blank line, then prose."
        )

        print(f"\n  Generating prose for {len(candidates)} insights...")
        for i, c in enumerate(candidates):
            ev = c["evidence"]
            age_str = f"{ev['age']}y" if ev.get("age") else "age unknown"
            flag_desc = []
            if "homegrown_abroad" in c["flags"]:
                flag_desc.append(f"homegrown ({ev['nation']})")
            if "young_upstep" in c["flags"]:
                flag_desc.append("young talent in smaller league")
            if "loan_performer" in c["flags"]:
                flag_desc.append("currently on loan")
            if "rising_trajectory" in c["flags"]:
                flag_desc.append("career trajectory rising")
            if "contract_opportunity" in c["flags"]:
                flag_desc.append("contract expiring soon")
            if "grade_mismatch" in c["flags"]:
                flag_desc.append("stats exceed scouting grade")

            prompt = (
                f"Player: {c['name']}, {age_str}, {ev['position']}\n"
                f"Club: {ev['club']} ({ev['league']})\n"
                f"Nation: {ev['nation']}\n"
                f"Stats this season: {ev['appearances']} apps, {ev['goals_p90']:.2f} G/90, "
                f"{ev['assists_p90']:.2f} A/90, {ev.get('rating') or 0:.1f} avg rating\n"
                f"Level: {ev['level']}, Gem Score: {c['gem_score']:.0f}/100\n"
                f"Context: {', '.join(flag_desc) if flag_desc else 'strong stats for level'}\n"
                f"Why flagged: stat percentile avg {ev['avg_percentile']:.0f}th across league+position peers"
            )

            result = router.call(prompt, system=SYSTEM_PROMPT)
            if result and result.text:
                lines = result.text.strip().split("\n", 2)
                headline = lines[0].strip().strip('"').strip("*")
                prose = lines[-1].strip() if len(lines) > 1 else ""
                # Clean up blank lines between headline and prose
                if len(lines) > 2:
                    prose = lines[2].strip()
                elif len(lines) == 2:
                    prose = lines[1].strip()
                c["headline"] = headline
                c["prose"] = prose
            else:
                c["headline"] = None
                c["prose"] = None

            if (i + 1) % 10 == 0:
                print(f"    {i + 1}/{len(candidates)} done")

        router.print_stats()
    else:
        for c in candidates:
            c["headline"] = None
            c["prose"] = None

    # ── Phase 6: Upsert ────────────────────────────────────────────────────

    if DRY_RUN:
        print(f"\n  --dry-run: would write {len(candidates)} insights")
        conn.rollback()
        conn.close()
        return

    from psycopg2.extras import execute_values

    now_iso = datetime.now(timezone.utc).isoformat()
    rows = []
    for c in candidates:
        rows.append((
            c["person_id"],
            "hidden_gem",
            c["gem_score"],
            c.get("headline"),
            c.get("prose"),
            json.dumps(c["evidence"]),
            SEASON,
            now_iso,
            now_iso,
        ))

    execute_values(cur, """
        INSERT INTO scout_insights (person_id, insight_type, gem_score, headline, prose, evidence, season, created_at, updated_at)
        VALUES %s
        ON CONFLICT (person_id, insight_type, season) DO UPDATE SET
            gem_score = EXCLUDED.gem_score,
            headline = EXCLUDED.headline,
            prose = EXCLUDED.prose,
            evidence = EXCLUDED.evidence,
            updated_at = EXCLUDED.updated_at
    """, rows)

    conn.commit()
    print(f"\n  Written {len(rows)} scout insights")
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
