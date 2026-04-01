"""
22_unified_grades.py — Unified multi-source grade engine.

Replaces scripts 22 (fbref), 30 (understat), 31 (statsbomb), 66 (api_football)
with a single engine that also adds Kaggle Euro League and Kaggle PL sources.

Cross-source percentile ranking: all players from all selected sources are pooled
together for fairer percentile computation. Each player contributes their best
available raw value per metric (highest SOURCE_PRIORITY wins). Grades are written
to attribute_grades tagged with the winning source.

Usage:
    python 22_unified_grades.py                          # all sources
    python 22_unified_grades.py --source api_football    # single source
    python 22_unified_grades.py --source fbref,understat # comma-separated
    python 22_unified_grades.py --min-minutes 450
    python 22_unified_grades.py --dry-run
    python 22_unified_grades.py --force
"""
from __future__ import annotations

import argparse
import math
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))

from lib.db import require_conn, get_dict_cursor
from lib.models import SOURCE_PRIORITY

# ── CLI ──────────────────────────────────────────────────────────────────────

ALL_SOURCES = ["fbref", "api_football", "understat", "statsbomb", "kaggle_euro", "kaggle_pl"]

parser = argparse.ArgumentParser(description="Unified multi-source → attribute_grades")
parser.add_argument("--source", default="all",
                    help=f"Comma-separated sources or 'all'. Options: {', '.join(ALL_SOURCES)}")
parser.add_argument("--season", default=None, help="Season filter (format varies by source)")
parser.add_argument("--min-minutes", type=int, default=450, help="Minimum minutes (default: 450)")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--force", action="store_true", help="Overwrite existing grades")
args = parser.parse_args()

DRY_RUN = args.dry_run
MIN_MINUTES = args.min_minutes
SOURCES = ALL_SOURCES if args.source == "all" else [s.strip() for s in args.source.split(",")]

# ── Position grouping ────────────────────────────────────────────────────────

ATTACKER_POS = {"CF", "WF", "AM"}
MIDFIELDER_POS = {"CM", "DM", "WM"}
DEFENDER_POS = {"CD", "WD"}
GK_POS = {"GK"}


def get_position_group(pos: str | None) -> str | None:
    if not pos:
        return None
    pos = pos.upper().strip()
    if pos in ATTACKER_POS:
        return "attacker"
    if pos in MIDFIELDER_POS:
        return "midfielder"
    if pos in DEFENDER_POS:
        return "defender"
    if pos in GK_POS:
        return "gk"
    return None


# ── SACROSANCT metric mapping ────────────────────────────────────────────────
# Each entry: attribute → {positions it applies to}
# All adapters map their raw metrics to these canonical names.

METRIC_POSITIONS = {
    # Striker — REMOVED: now handled by AF/ASA composite grades (pipeline 66/68)
    # with quality signals (goals_per_shot, avg_rating, npg_p90). Old understat
    # methodology mapped raw goals_p90 → close_range which inflated mid-tier
    # strikers (Gabriel Jesus RS 88 with 6.56 avg_rating).
    # "close_range", "mid_range", "long_range", "penalties" — see pipeline 66
    # Creator
    "creativity":     {"attacker", "midfielder", "defender"},
    "vision":         {"attacker", "midfielder"},
    # Passer
    "pass_accuracy":  {"attacker", "midfielder", "defender"},
    "pass_range":     {"attacker", "midfielder", "defender"},
    "through_balls":  {"attacker", "midfielder"},
    # Destroyer
    "tackling":       {"midfielder", "defender"},
    "blocking":       {"midfielder", "defender"},
    "clearances":     {"defender"},
    "marking":        {"defender"},
    # Cover
    "interceptions":  {"midfielder", "defender"},
    "awareness":      {"midfielder", "defender"},
    "discipline":     {"attacker", "midfielder", "defender"},
    # Dribbler
    "take_ons":       {"attacker", "midfielder"},
    "carries":        {"attacker", "midfielder"},
    # Engine
    "intensity":      {"attacker", "midfielder", "defender"},
    "pressing":       {"attacker", "midfielder", "defender"},
    # Powerhouse
    "duels":          {"attacker", "midfielder", "defender"},
    "aggression":     {"attacker", "midfielder", "defender"},
    "aerial_duels":   {"attacker", "midfielder", "defender"},
    # Controller
    "composure":      {"attacker", "midfielder", "defender"},
    # Other
    "threat":         {"attacker", "midfielder"},
    # GK
    "reactions":      {"gk"},
    "handling":       {"gk"},
    "footwork":       {"gk"},
}

# Metrics where higher raw value = WORSE (inverted for percentile ranking)
INVERTED_METRICS = {"aggression", "discipline_raw"}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _num(val):
    """Coerce Decimal/str to float, None stays None."""
    if val is None:
        return None
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (ValueError, TypeError):
        return None


def _per90(val, minutes):
    val, minutes = _num(val), _num(minutes)
    if not val or not minutes or minutes < 1:
        return None
    return val / minutes * 90


def _pct(num, denom, min_denom=5):
    num, denom = _num(num), _num(denom)
    if not num or not denom or denom < min_denom:
        return None
    return num / denom * 100


def percentile_to_score(pct: float) -> int:
    """Convert 0-100 percentile to 1-10 SACROSANCT scale."""
    return max(1, min(10, round(pct / 10)))


# ── Source Adapters ──────────────────────────────────────────────────────────
# Each returns: {person_id: {metric_name: raw_value}}


def fetch_fbref(cur) -> dict[int, dict[str, float]]:
    """FBRef season stats → raw metrics."""
    season_clause = ""
    params = [MIN_MINUTES]
    if args.season:
        season_clause = "AND s.season = %s"
        params.append(args.season)

    cur.execute(f"""
        SELECT
            fp.person_id, s.minutes, s.goals, s.assists, s.shots, s.shots_on_target,
            s.xg, s.npxg, s.xag, s.passes_completed, s.passes_attempted, s.pass_pct,
            s.progressive_passes, s.key_passes, s.tackles, s.tackles_won,
            s.interceptions, s.blocks, s.clearances, s.carries, s.progressive_carries,
            s.successful_dribbles, s.dribbles_attempted,
            s.gk_saves, s.gk_save_pct, s.gk_clean_sheets, s.gk_goals_against, s.gk_psxg,
            pp.position, s.matches_played
        FROM fbref_player_season_stats s
        JOIN fbref_players fp ON fp.fbref_id = s.fbref_id
        LEFT JOIN player_profiles pp ON pp.person_id = fp.person_id
        WHERE fp.person_id IS NOT NULL AND s.minutes >= %s {season_clause}
        ORDER BY fp.person_id, s.season DESC
    """, params)

    seen = set()
    results = {}
    for d in cur.fetchall():
        pid = d["person_id"]
        if pid in seen:
            continue
        seen.add(pid)

        mins = _num(d["minutes"]) or 0
        if mins <= 0:
            continue

        m = {}
        pg = get_position_group(d.get("position"))

        if pg != "gk":
            m["close_range"] = _per90(d.get("goals"), mins)
            shots = _num(d.get("shots")) or 0
            if shots >= 5:
                m["mid_range"] = (_num(d.get("shots_on_target")) or 0) / shots * 100
            xg = _num(d.get("xg"))
            goals = _num(d.get("goals")) or 0
            if xg is not None:
                m["long_range"] = _per90(goals - xg, mins)
            key_passes = _num(d.get("key_passes"))
            if key_passes is not None:
                m["creativity"] = _per90(key_passes, mins)
            elif (_num(d.get("assists")) or 0) > 0:
                m["creativity"] = _per90(d.get("assists"), mins)
            xag = _num(d.get("xag"))
            if xag is not None:
                m["vision"] = _per90(xag, mins)
            elif (_num(d.get("assists")) or 0) > 0:
                m["vision"] = _per90(d.get("assists"), mins)
            pass_pct = _num(d.get("pass_pct"))
            if pass_pct is not None:
                m["pass_accuracy"] = pass_pct
            m["pass_range"] = _per90(d.get("progressive_passes"), mins)
            if xag is not None:
                m["through_balls"] = _per90(xag, mins)
            elif (_num(d.get("assists")) or 0) > 0:
                m["through_balls"] = _per90(d.get("assists"), mins)
            m["tackling"] = _per90(d.get("tackles_won"), mins)
            m["interceptions"] = _per90(d.get("interceptions"), mins)
            tackles = _num(d.get("tackles")) or 0
            intercepts = _num(d.get("interceptions")) or 0
            m["awareness"] = _per90(tackles + intercepts, mins)
            m["blocking"] = _per90(d.get("blocks"), mins)
            m["clearances"] = _per90(d.get("clearances"), mins)
            drib_att = _num(d.get("dribbles_attempted")) or 0
            if drib_att >= 5:
                m["take_ons"] = (_num(d.get("successful_dribbles")) or 0) / drib_att * 100
            m["carries"] = _per90(d.get("progressive_carries"), mins)

        if pg == "gk" or (pg is None and (_num(d.get("gk_saves")) or 0) > 0):
            matches = _num(d.get("matches_played")) or 1
            gk_save_pct = _num(d.get("gk_save_pct"))
            if gk_save_pct is not None:
                m["handling"] = gk_save_pct
            if matches >= 3:
                m["footwork"] = (_num(d.get("gk_clean_sheets")) or 0) / matches * 100
            gk_psxg = _num(d.get("gk_psxg"))
            gk_ga = _num(d.get("gk_goals_against"))
            if gk_psxg is not None and gk_ga is not None:
                m["reactions"] = _per90(gk_psxg - gk_ga, mins)

        results[pid] = {k: v for k, v in m.items() if v is not None}
    return results


def fetch_api_football(cur) -> dict[int, dict[str, float]]:
    """API-Football season stats → raw metrics."""
    season = args.season or "2025"
    cur.execute("""
        SELECT
            s.person_id, s.minutes, s.appearances, s.rating,
            s.goals, s.assists, s.shots_total, s.shots_on,
            s.passes_total, s.passes_key, s.passes_accuracy,
            s.tackles_total, s.blocks, s.interceptions,
            s.duels_total, s.duels_won,
            s.dribbles_attempted, s.dribbles_success,
            s.fouls_drawn, s.fouls_committed,
            s.cards_yellow, s.cards_red,
            s.penalties_scored, s.penalties_missed
        FROM api_football_player_stats s
        WHERE s.person_id IS NOT NULL AND s.minutes >= %s AND s.season = %s
    """, (MIN_MINUTES, season))

    results = {}
    for d in cur.fetchall():
        pid = d["person_id"]
        mins = _num(d["minutes"])
        if not mins or mins < 1:
            continue
        m = {}

        m["close_range"] = _per90(d.get("goals"), mins)
        m["mid_range"] = _pct(d.get("shots_on"), d.get("shots_total"))
        m["long_range"] = _per90(d.get("shots_total"), mins)
        m["creativity"] = _per90(d.get("passes_key"), mins)
        m["vision"] = _per90(d.get("assists"), mins)
        m["pass_accuracy"] = _num(d.get("passes_accuracy"))
        m["tackling"] = _per90(d.get("tackles_total"), mins)
        m["blocking"] = _per90(d.get("blocks"), mins)
        m["interceptions"] = _per90(d.get("interceptions"), mins)
        m["awareness"] = _per90((_num(d.get("tackles_total")) or 0) + (_num(d.get("interceptions")) or 0), mins)
        m["duels"] = _pct(d.get("duels_won"), d.get("duels_total"))
        m["take_ons"] = _pct(d.get("dribbles_success"), d.get("dribbles_attempted"))
        m["threat"] = _per90(d.get("fouls_drawn"), mins)

        # Discipline: fewer cards = better (inverted in percentile step)
        total_cards = (_num(d.get("cards_yellow")) or 0) + (_num(d.get("cards_red")) or 0) * 2
        m["discipline_raw"] = _per90(total_cards, mins)

        pen_total = (_num(d.get("penalties_scored")) or 0) + (_num(d.get("penalties_missed")) or 0)
        if pen_total >= 2:
            m["penalties"] = _pct(d.get("penalties_scored"), pen_total, min_denom=2)

        rating = _num(d.get("rating"))
        if rating:
            m["composure"] = rating

        results[pid] = {k: v for k, v in m.items() if v is not None}
    return results


def fetch_understat(cur) -> dict[int, dict[str, float]]:
    """Understat match stats → raw per-90 metrics."""
    cur.execute("""
        SELECT
            pil.person_id,
            sum(upms.time::numeric) as total_mins,
            sum(upms.xg::numeric) as total_xg,
            sum(upms.xa::numeric) as total_xa,
            sum(upms.key_passes::numeric) as total_kp,
            sum(upms.shots::numeric) as total_shots,
            sum(upms.goals::numeric) as total_goals,
            sum(upms.assists::numeric) as total_assists,
            sum(upms.xgchain::numeric) as total_chain,
            sum(upms.xgbuildup::numeric) as total_buildup,
            sum(upms.npg::numeric) as total_npg
        FROM player_id_links pil
        JOIN understat_player_match_stats upms ON upms.player_id::text = pil.external_id
        WHERE pil.source = 'understat' AND upms.time > 0
        GROUP BY pil.person_id
        HAVING sum(upms.time::numeric) >= %s
    """, (MIN_MINUTES,))

    results = {}
    for d in cur.fetchall():
        pid = d["person_id"]
        mins = _num(d["total_mins"])
        if not mins or mins <= 0:
            continue

        xg_p90 = _num(d["total_xg"]) / mins * 90
        xa_p90 = _num(d["total_xa"]) / mins * 90
        kp_p90 = _num(d["total_kp"]) / mins * 90
        shots_p90 = _num(d["total_shots"]) / mins * 90
        goals_p90 = _num(d["total_goals"]) / mins * 90
        chain_p90 = _num(d["total_chain"]) / mins * 90
        buildup_p90 = _num(d["total_buildup"]) / mins * 90

        m = {}
        # Striker metrics (blended from xG + goals)
        m["close_range"] = xg_p90 * 0.6 + goals_p90 * 0.4
        m["mid_range"] = shots_p90 * 0.5 + xg_p90 * 0.5
        m["long_range"] = shots_p90 * 0.7 + goals_p90 * 0.3
        # Creator
        m["creativity"] = xa_p90 * 0.5 + kp_p90 * 0.5
        m["vision"] = xa_p90 * 0.4 + kp_p90 * 0.4 + chain_p90 * 0.2
        # Passer
        m["through_balls"] = xa_p90 * 0.5 + kp_p90 * 0.5
        # Engine
        m["intensity"] = chain_p90 * 0.5 + buildup_p90 * 0.5
        # Dribbler
        m["carries"] = chain_p90 * 0.4 + buildup_p90 * 0.3 + xg_p90 * 0.3
        # Cover
        m["awareness"] = buildup_p90 * 0.6 + chain_p90 * 0.4

        results[pid] = {k: v for k, v in m.items() if v is not None}
    return results


def fetch_statsbomb(cur) -> dict[int, dict[str, float]]:
    """StatsBomb event data → raw per-90 metrics via player_id_links.

    Uses sb_lineups for minutes and sb_events for event counts.
    Falls back to statsbombpy API if DB tables are empty.
    """
    # Check if we have DB events
    cur.execute("SELECT count(*) as cnt FROM sb_matches")
    match_count = cur.fetchone()["cnt"]
    if match_count == 0:
        print("    [statsbomb] No matches in DB, skipping (run 08_statsbomb_ingest first)")
        return {}

    # Get player links
    cur.execute("SELECT external_id, person_id FROM player_id_links WHERE source = 'statsbomb'")
    links = {row["external_id"]: row["person_id"] for row in cur.fetchall()}
    if not links:
        print("    [statsbomb] No player links found")
        return {}

    # Try to get lineup minutes from sb_lineups
    cur.execute("""
        SELECT count(*) as cnt FROM information_schema.tables
        WHERE table_name = 'sb_lineups'
    """)
    has_lineups = cur.fetchone()["cnt"] > 0

    if not has_lineups:
        print("    [statsbomb] No sb_lineups table — using statsbombpy API")
        return _fetch_statsbomb_api(links)

    # DB path: aggregate from sb_lineups + sb_events
    cur.execute("""
        SELECT player_id::text as player_id, count(distinct match_id) as matches
        FROM sb_lineups
        GROUP BY player_id
    """)
    player_matches = {row["player_id"]: int(row["matches"]) for row in cur.fetchall()}

    # Estimate minutes (70 per appearance, conservative)
    qualifying_sb = {}
    for sb_id, n_matches in player_matches.items():
        est_mins = n_matches * 70
        if est_mins >= MIN_MINUTES and sb_id in links:
            qualifying_sb[sb_id] = est_mins

    if not qualifying_sb:
        print("    [statsbomb] No qualifying players from lineups")
        return {}

    # Count events per player
    sb_ids_str = ",".join(f"'{sid}'" for sid in qualifying_sb)
    cur.execute(f"""
        SELECT player::text as player_id, type, count(*) as cnt
        FROM sb_events
        WHERE player::text IN ({sb_ids_str})
        GROUP BY player::text, type
    """)

    player_events = defaultdict(lambda: defaultdict(int))
    for row in cur.fetchall():
        player_events[row["player_id"]][row["type"]] = int(row["cnt"])

    results = {}
    for sb_id, est_mins in qualifying_sb.items():
        person_id = links.get(sb_id)
        if not person_id:
            continue
        ev = player_events.get(sb_id, {})
        m = {}
        m["tackling"] = _per90(ev.get("Tackle", 0), est_mins)
        m["interceptions"] = _per90(ev.get("Interception", 0), est_mins)
        m["blocking"] = _per90(ev.get("Block", 0), est_mins)
        m["clearances"] = _per90(ev.get("Clearance", 0), est_mins)
        m["pressing"] = _per90(ev.get("Pressure", 0), est_mins)
        m["carries"] = _per90(ev.get("Carry", 0), est_mins)
        m["awareness"] = _per90((ev.get("Tackle", 0) + ev.get("Interception", 0)), est_mins)
        results[person_id] = {k: v for k, v in m.items() if v is not None}
    return results


def _fetch_statsbomb_api(links: dict) -> dict[int, dict[str, float]]:
    """Fallback: fetch events from StatsBomb API (slow)."""
    try:
        from statsbombpy import sb
        import warnings
        warnings.filterwarnings("ignore", message="credentials were not supplied")
    except ImportError:
        print("    [statsbomb] statsbombpy not installed, skipping")
        return {}

    import psycopg2
    conn2 = require_conn()
    cur2 = conn2.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur2.execute("SELECT match_id FROM sb_matches ORDER BY match_id")
    match_ids = [r["match_id"] for r in cur2.fetchall()]
    conn2.close()

    if not match_ids:
        return {}

    print(f"    [statsbomb] Processing {len(match_ids)} matches via API...")
    player_stats = defaultdict(lambda: {"match_count": 0, "tackles": 0, "interceptions": 0,
                                         "blocks": 0, "clearances": 0, "pressures": 0,
                                         "dribbles_won": 0, "carries": 0, "_matches": set()})

    for i, mid in enumerate(match_ids):
        if (i + 1) % 100 == 0:
            print(f"    [statsbomb] {i+1}/{len(match_ids)}...", end="\r")
        try:
            events = sb.events(match_id=mid)
        except Exception:
            continue
        if events.empty:
            continue

        for _, ev in events.iterrows():
            player = ev.get("player")
            if not player or str(player) == "nan":
                continue
            pid = str(player)
            ps = player_stats[pid]
            if mid not in ps["_matches"]:
                ps["_matches"].add(mid)
                ps["match_count"] += 1
            etype = ev.get("type", "")
            if etype == "Duel":
                outcome = ev.get("duel_outcome", "")
                duel_type = ev.get("duel_type", "")
                if outcome in ("Won", "Success", "Success In Play", "Success Out"):
                    if duel_type == "Tackle":
                        ps["tackles"] += 1
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

    print()

    # Build name→person_id map for fallback matching
    conn3 = require_conn()
    cur3 = conn3.cursor()
    cur3.execute("SELECT id, lower(name) FROM people")
    name_map = {row[1]: row[0] for row in cur3.fetchall()}
    conn3.close()

    results = {}
    for sb_name, ps in player_stats.items():
        est_mins = ps["match_count"] * 70
        if est_mins < MIN_MINUTES:
            continue
        person_id = links.get(sb_name) or name_map.get(sb_name.lower().strip())
        if not person_id:
            continue
        m = {}
        m["tackling"] = _per90(ps["tackles"], est_mins)
        m["interceptions"] = _per90(ps["interceptions"], est_mins)
        m["blocking"] = _per90(ps["blocks"], est_mins)
        m["clearances"] = _per90(ps["clearances"], est_mins)
        m["pressing"] = _per90(ps["pressures"], est_mins)
        m["take_ons"] = _per90(ps["dribbles_won"], est_mins)
        m["carries"] = _per90(ps["carries"], est_mins)
        m["awareness"] = _per90(ps["tackles"] + ps["interceptions"], est_mins)
        results[person_id] = {k: v for k, v in m.items() if v is not None}
    return results


def fetch_kaggle_euro(cur) -> dict[int, dict[str, float]]:
    """Kaggle European Top Leagues stats → raw metrics."""
    season_clause = ""
    params = [MIN_MINUTES]
    if args.season:
        season_clause = "AND season = %s"
        params.append(args.season)

    cur.execute(f"""
        SELECT person_id, minutes, goals, assists, xg, npxg, xa,
               progressive_carries, progressive_passes, matches_played
        FROM kaggle_euro_league_stats
        WHERE person_id IS NOT NULL AND minutes >= %s {season_clause}
        ORDER BY person_id, season DESC
    """, params)

    seen = set()
    results = {}
    for d in cur.fetchall():
        pid = d["person_id"]
        if pid in seen:
            continue
        seen.add(pid)

        mins = _num(d["minutes"]) or 0
        if mins <= 0:
            continue

        m = {}
        m["close_range"] = _per90(d.get("goals"), mins)
        m["mid_range"] = _per90(d.get("xg"), mins)
        m["vision"] = _per90(d.get("assists"), mins)
        m["creativity"] = _per90(d.get("xa"), mins)
        m["carries"] = _per90(d.get("progressive_carries"), mins)
        m["pass_range"] = _per90(d.get("progressive_passes"), mins)

        results[pid] = {k: v for k, v in m.items() if v is not None}
    return results


def fetch_kaggle_pl(cur) -> dict[int, dict[str, float]]:
    """Kaggle Premier League stats → raw metrics (richer than Euro)."""
    season_clause = ""
    params = [MIN_MINUTES]
    if args.season:
        season_clause = "AND season = %s"
        params.append(args.season)

    cur.execute(f"""
        SELECT person_id,
               sum(minutes) as minutes,
               sum(goals) as goals,
               sum(assists) as assists,
               sum(xg::numeric) as xg,
               sum(xa::numeric) as xa,
               sum(npxg::numeric) as npxg,
               sum(progressive_carries) as progressive_carries,
               sum(progressive_passes) as progressive_passes,
               sum(tackles) as tackles,
               sum(interceptions) as interceptions,
               sum(blocks) as blocks,
               sum(sca) as sca,
               sum(gca) as gca,
               avg(pass_completion) as pass_completion,
               sum(aerial_won) as aerial_won,
               sum(aerial_lost) as aerial_lost
        FROM kaggle_pl_stats
        WHERE person_id IS NOT NULL {season_clause}
        GROUP BY person_id
        HAVING sum(minutes) >= %s
    """, params)

    results = {}
    for d in cur.fetchall():
        pid = d["person_id"]
        mins = _num(d["minutes"]) or 0
        if mins <= 0:
            continue

        m = {}
        m["close_range"] = _per90(d.get("goals"), mins)
        m["mid_range"] = _per90(d.get("xg"), mins)
        m["vision"] = _per90(d.get("assists"), mins)
        m["creativity"] = _per90(d.get("xa"), mins)
        m["carries"] = _per90(d.get("progressive_carries"), mins)
        m["pass_range"] = _per90(d.get("progressive_passes"), mins)
        m["tackling"] = _per90(d.get("tackles"), mins)
        m["interceptions"] = _per90(d.get("interceptions"), mins)
        m["blocking"] = _per90(d.get("blocks"), mins)
        m["awareness"] = _per90((_num(d.get("tackles")) or 0) + (_num(d.get("interceptions")) or 0), mins)
        m["threat"] = _per90(d.get("sca"), mins)
        m["through_balls"] = _per90(d.get("gca"), mins)
        pass_comp = _num(d.get("pass_completion"))
        if pass_comp is not None:
            m["pass_accuracy"] = pass_comp
        aerial_total = (_num(d.get("aerial_won")) or 0) + (_num(d.get("aerial_lost")) or 0)
        if aerial_total >= 5:
            m["aerial_duels"] = _pct(d.get("aerial_won"), aerial_total, min_denom=5)

        results[pid] = {k: v for k, v in m.items() if v is not None}
    return results


# ── Adapter registry ─────────────────────────────────────────────────────────

ADAPTERS = {
    "fbref":         fetch_fbref,
    "api_football":  fetch_api_football,
    "understat":     fetch_understat,
    "statsbomb":     fetch_statsbomb,
    "kaggle_euro":   fetch_kaggle_euro,
    "kaggle_pl":     fetch_kaggle_pl,
}

# Map adapter name → attribute_grades source tag
SOURCE_TAG = {
    "fbref":         "fbref",
    "api_football":  "api_football",
    "understat":     "understat",
    "statsbomb":     "statsbomb",
    "kaggle_euro":   "kaggle_euro",
    "kaggle_pl":     "kaggle_pl",
}


# ── Cross-source engine ─────────────────────────────────────────────────────

def merge_sources(all_data: dict[str, dict[int, dict[str, float]]]) -> tuple[
    dict[int, dict[str, float]],  # merged {pid: {metric: raw_value}}
    dict[int, dict[str, str]],    # provenance {pid: {metric: source_tag}}
]:
    """Merge per-source raw metrics. Per metric per player, highest-priority source wins."""
    merged = defaultdict(dict)
    provenance = defaultdict(dict)

    for source_name, player_metrics in all_data.items():
        tag = SOURCE_TAG[source_name]
        priority = SOURCE_PRIORITY.get(tag, 0)

        for pid, metrics in player_metrics.items():
            for metric, raw_val in metrics.items():
                existing_source = provenance.get(pid, {}).get(metric)
                existing_priority = SOURCE_PRIORITY.get(existing_source, -1) if existing_source else -1

                if priority > existing_priority:
                    merged[pid][metric] = raw_val
                    provenance[pid][metric] = tag

    return dict(merged), dict(provenance)


def compute_cross_source_percentiles(
    merged: dict[int, dict[str, float]],
    player_positions: dict[int, str | None],
) -> dict[int, dict[str, int]]:
    """Percentile rank all players across sources, within position groups.

    Returns {person_id: {metric: score_1_to_10}}.
    """
    # Collect all metrics present
    all_metrics = set()
    for metrics in merged.values():
        all_metrics.update(metrics.keys())

    # Group players by position
    groups = defaultdict(list)
    for pid in merged:
        pg = player_positions.get(pid)
        groups[pg or "unknown"].append(pid)

    results = defaultdict(dict)

    for metric in all_metrics:
        is_inverted = metric in INVERTED_METRICS
        valid_positions = METRIC_POSITIONS.get(metric)

        for group_name, pids in groups.items():
            # Check if this metric is relevant for this position group
            if valid_positions and group_name != "unknown" and group_name not in valid_positions:
                continue

            # Collect values
            vals = []
            for pid in pids:
                v = merged.get(pid, {}).get(metric)
                if v is not None:
                    vals.append((pid, v))

            if len(vals) < 3:
                continue

            # Sort and rank
            vals.sort(key=lambda x: x[1])
            n = len(vals)
            for rank, (pid, _) in enumerate(vals):
                pct = (rank / max(n - 1, 1)) * 100
                if is_inverted:
                    pct = 100 - pct

                # Map discipline_raw → discipline for output
                out_metric = "discipline" if metric == "discipline_raw" else metric
                results[pid][out_metric] = percentile_to_score(pct)

    return dict(results)


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    conn = require_conn()
    cur = get_dict_cursor(conn)

    print("22 — Unified Multi-Source Grade Engine")
    print(f"  Sources:     {', '.join(SOURCES)}")
    print(f"  Min minutes: {MIN_MINUTES}")
    print(f"  Season:      {args.season or 'latest/all'}")
    print(f"  Mode:        {'DRY RUN' if DRY_RUN else 'LIVE'}")
    print()

    # ── 1. Load player positions ──────────────────────────────────────────
    cur.execute("SELECT person_id, position FROM player_profiles WHERE position IS NOT NULL")
    player_positions = {}
    for row in cur.fetchall():
        player_positions[row["person_id"]] = get_position_group(row["position"])
    print(f"  {len(player_positions):,} players with known positions")

    # ── 2. Fetch raw metrics from each source ─────────────────────────────
    all_data = {}
    for source in SOURCES:
        adapter = ADAPTERS.get(source)
        if not adapter:
            print(f"  [!] Unknown source: {source}")
            continue
        print(f"\n  Fetching {source}...")
        try:
            data = adapter(cur)
            all_data[source] = data
            print(f"    → {len(data):,} players")
        except Exception as e:
            print(f"    → ERROR: {e}")

    if not all_data:
        print("\n  No data from any source. Exiting.")
        conn.close()
        return

    # ── 3. Merge across sources ───────────────────────────────────────────
    merged, provenance = merge_sources(all_data)
    total_metrics = sum(len(m) for m in merged.values())
    print(f"\n  Merged pool: {len(merged):,} unique players, {total_metrics:,} metric values")

    # Source contribution summary
    source_counts = defaultdict(int)
    for pid_prov in provenance.values():
        for src in pid_prov.values():
            source_counts[src] += 1
    for src, cnt in sorted(source_counts.items(), key=lambda x: -x[1]):
        print(f"    {src:20s} → {cnt:,} winning metrics")

    # ── 4. Cross-source percentile ranking ────────────────────────────────
    print("\n  Computing cross-source percentiles...")
    scores = compute_cross_source_percentiles(merged, player_positions)
    total_scores = sum(len(s) for s in scores.values())
    print(f"  Scores computed: {total_scores:,} for {len(scores):,} players")

    # ── 5. Build upsert rows ─────────────────────────────────────────────
    now_iso = datetime.now(timezone.utc).isoformat()
    upsert_rows = []

    for pid, metric_scores in scores.items():
        for metric, score in metric_scores.items():
            source_tag = provenance.get(pid, {}).get(
                "discipline_raw" if metric == "discipline" else metric,
                "computed"
            )
            upsert_rows.append({
                "player_id": pid,
                "attribute": metric,
                "stat_score": score,
                "source": source_tag,
                "is_inferred": True,
                "confidence": "Medium",
                "updated_at": now_iso,
            })

    print(f"  Total grades to write: {len(upsert_rows):,}")

    # ── Sample output ────────────────────────────────────────────────────
    if upsert_rows:
        sample_pid = next(iter(scores))
        sample_scores = scores[sample_pid]
        sample_prov = provenance.get(sample_pid, {})
        print(f"\n  Sample (person_id={sample_pid}):")
        for metric, sc in sorted(sample_scores.items()):
            src = sample_prov.get("discipline_raw" if metric == "discipline" else metric, "?")
            raw = merged.get(sample_pid, {}).get("discipline_raw" if metric == "discipline" else metric)
            raw_str = f"{raw:.3f}" if isinstance(raw, float) else str(raw)
            print(f"    {metric:20s} = {sc:2d}/10  (raw={raw_str:>8s}, src={src})")

    if DRY_RUN:
        print("\n  [dry-run] No data written.")
        conn.close()
        return

    # ── 6. Write to attribute_grades ──────────────────────────────────────
    from psycopg2.extras import execute_values
    write_cur = conn.cursor()

    # Clear old grades for sources we're replacing
    source_tags = set(SOURCE_TAG[s] for s in SOURCES if s in SOURCE_TAG)
    for tag in source_tags:
        write_cur.execute("DELETE FROM attribute_grades WHERE source = %s", (tag,))
        deleted = write_cur.rowcount
        if deleted:
            print(f"  Cleared {deleted:,} old '{tag}' grades")

    # Batch insert
    BATCH = 500
    written = 0
    for i in range(0, len(upsert_rows), BATCH):
        batch = upsert_rows[i:i + BATCH]
        execute_values(write_cur, """
            INSERT INTO attribute_grades (player_id, attribute, stat_score, source, is_inferred, confidence, updated_at)
            VALUES %s
            ON CONFLICT (player_id, attribute, source) DO UPDATE SET
                stat_score = EXCLUDED.stat_score,
                is_inferred = EXCLUDED.is_inferred,
                confidence = EXCLUDED.confidence,
                updated_at = EXCLUDED.updated_at
        """, [
            (g["player_id"], g["attribute"], g["stat_score"], g["source"],
             g["is_inferred"], g["confidence"], g["updated_at"])
            for g in batch
        ])
        written += len(batch)

    conn.commit()
    conn.close()

    print(f"\n  Written {written:,} grades across {len(scores):,} players")
    print("Done.")


if __name__ == "__main__":
    main()
