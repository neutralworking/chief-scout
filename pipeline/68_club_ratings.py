"""
68_club_ratings.py — Compute club power ratings (0-100).

Four-pillar composite:
  1. xG Differential (35%) — understat → AF goal diff → squad overall fallback
  2. Squad Value (25%) — kaggle transfer values → market tier → CS value
  3. Defensive Intensity (20%) — AF tackles/interceptions/duels → attribute grades
  4. Buildup Quality (20%) — AF pass accuracy + FBRef progressive passes → attr grades

League-normalized via league_coefficients.strength_factor.

Usage:
    python 68_club_ratings.py                    # default season
    python 68_club_ratings.py --season 2025
    python 68_club_ratings.py --dry-run
    python 68_club_ratings.py --club "Arsenal"
    python 68_club_ratings.py --force
"""

import argparse
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))

from lib.db import require_conn, get_dict_cursor

# ── Args ──────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Compute club power ratings")
parser.add_argument("--season", default="2025", help="Season (default: 2025)")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--force", action="store_true", help="Overwrite existing ratings")
parser.add_argument("--club", type=str, help="Single club name to process")
args = parser.parse_args()

DRY_RUN = args.dry_run
SEASON = args.season

# ── Weights ───────────────────────────────────────────────────────────────────

W_XG = 0.35
W_VALUE = 0.25
W_DEFENSE = 0.20
W_BUILDUP = 0.20


def rank_normalize(values: dict[int, float]) -> dict[int, float]:
    """Rank-normalize a dict of club_id → raw_value to 0-100 percentile scores."""
    if not values:
        return {}
    sorted_ids = sorted(values.keys(), key=lambda k: values[k])
    n = len(sorted_ids)
    if n == 1:
        return {sorted_ids[0]: 50.0}
    return {cid: (rank / (n - 1)) * 100.0 for rank, cid in enumerate(sorted_ids)}


def main():
    conn = require_conn()
    cur = get_dict_cursor(conn)

    print(f"Club Power Ratings — season {SEASON}")
    print(f"  Mode: {'DRY RUN' if DRY_RUN else 'LIVE'}")

    # ── Load clubs ────────────────────────────────────────────────────────────

    if args.club:
        cur.execute("SELECT id, clubname, league_name, uefa_coefficient FROM clubs WHERE LOWER(clubname) = LOWER(%s)", (args.club,))
    else:
        cur.execute("SELECT id, clubname, league_name, uefa_coefficient FROM clubs WHERE id IN (SELECT DISTINCT club_id FROM people WHERE club_id IS NOT NULL AND active = true)")

    clubs = {r["id"]: r for r in cur.fetchall()}
    print(f"  {len(clubs)} clubs to rate")

    if not clubs:
        print("  No clubs found. Done.")
        conn.close()
        return

    club_ids = list(clubs.keys())

    # ── Load league strength factors ──────────────────────────────────────────

    cur.execute("SELECT league_name, strength_factor FROM league_coefficients WHERE season = %s", (SEASON,))
    league_strength = {r["league_name"]: float(r["strength_factor"]) for r in cur.fetchall()}
    print(f"  {len(league_strength)} league strength factors loaded")

    # ══════════════════════════════════════════════════════════════════════════
    # PILLAR 1: xG Differential (35%)
    # ══════════════════════════════════════════════════════════════════════════

    xg_diff_raw: dict[int, float] = {}
    xg_sources: dict[int, str] = {}

    # Try Understat first — best xG source
    # Match via clubname OR short_name since understat uses its own naming
    cur.execute("""
        SELECT c.id AS club_id,
               AVG(
                   CASE WHEN LOWER(um.home_team) = LOWER(c.clubname) OR LOWER(um.home_team) = LOWER(c.short_name)
                        THEN um.home_xg - um.away_xg
                        WHEN LOWER(um.away_team) = LOWER(c.clubname) OR LOWER(um.away_team) = LOWER(c.short_name)
                        THEN um.away_xg - um.home_xg
                   END
               ) AS avg_xg_diff,
               COUNT(*) AS matches
        FROM clubs c
        JOIN understat_matches um
            ON LOWER(um.home_team) IN (LOWER(c.clubname), LOWER(c.short_name))
            OR LOWER(um.away_team) IN (LOWER(c.clubname), LOWER(c.short_name))
        WHERE c.id = ANY(%s)
          AND um.season = %s
        GROUP BY c.id
        HAVING COUNT(*) >= 5
    """, (club_ids, SEASON))

    for r in cur.fetchall():
        xg_diff_raw[r["club_id"]] = float(r["avg_xg_diff"])
        xg_sources[r["club_id"]] = "understat"

    print(f"  Pillar 1 (xG): {len(xg_diff_raw)} clubs from Understat")

    # Fallback: API-Football actual goal differential (0.85 confidence penalty applied later)
    # AF only has goals scored per player, not conceded — use goals as a proxy for attacking strength
    missing_xg = [cid for cid in club_ids if cid not in xg_diff_raw]
    if missing_xg:
        cur.execute("""
            SELECT p.club_id,
                   SUM(afs.goals) * 1.0 / NULLIF(SUM(afs.appearances), 0) AS goals_per_match,
                   SUM(afs.appearances) AS total_app
            FROM api_football_player_stats afs
            JOIN people p ON p.id = afs.person_id
            WHERE p.club_id = ANY(%s)
              AND afs.season = %s
              AND afs.appearances > 0
            GROUP BY p.club_id
            HAVING SUM(afs.appearances) >= 20
        """, (missing_xg, SEASON))

        for r in cur.fetchall():
            if r["goals_per_match"] is not None:
                # Convert goals/match to approximate xG diff (offset from league avg ~1.3 goals/match)
                xg_diff_raw[r["club_id"]] = float(r["goals_per_match"]) - 1.3
                xg_sources[r["club_id"]] = "api_football_gd"

        print(f"  Pillar 1 (xG): +{len([c for c in missing_xg if c in xg_diff_raw])} from AF goal diff")

    # Last resort: average overall of top 14 players → synthetic xG proxy
    still_missing = [cid for cid in club_ids if cid not in xg_diff_raw]
    if still_missing:
        for cid in still_missing:
            cur.execute("""
                SELECT overall FROM player_profiles pp
                JOIN people p ON p.id = pp.person_id
                WHERE p.club_id = %s AND p.active = true AND pp.overall IS NOT NULL
                ORDER BY pp.overall DESC LIMIT 14
            """, (cid,))
            rows = cur.fetchall()
            if len(rows) >= 5:
                avg_ovr = sum(float(r["overall"]) for r in rows) / len(rows)
                # Map 60-90 overall to roughly -1.5 to +1.5 xG diff
                xg_diff_raw[cid] = (avg_ovr - 75.0) / 10.0
                xg_sources[cid] = "squad_overall"

        print(f"  Pillar 1 (xG): +{len([c for c in still_missing if c in xg_diff_raw])} from squad overall proxy")

    # ══════════════════════════════════════════════════════════════════════════
    # PILLAR 2: Squad Value (25%)
    # ══════════════════════════════════════════════════════════════════════════

    squad_value_raw: dict[int, float] = {}
    value_sources: dict[int, str] = {}

    # Kaggle transfer values
    cur.execute("""
        SELECT p.club_id,
               SUM(ktv.market_value_eur) / 1e6 AS total_meur
        FROM kaggle_transfer_values ktv
        JOIN people p ON LOWER(p.name) = LOWER(ktv.player_name)
        WHERE p.club_id = ANY(%s)
          AND p.active = true
          AND ktv.market_value_eur > 0
        GROUP BY p.club_id
    """, (club_ids,))

    for r in cur.fetchall():
        if r["total_meur"] and float(r["total_meur"]) > 0:
            squad_value_raw[r["club_id"]] = float(r["total_meur"])
            value_sources[r["club_id"]] = "kaggle"

    print(f"  Pillar 2 (Value): {len(squad_value_raw)} clubs from Kaggle")

    # Fill gaps with market_value_tier midpoints
    MVT_MIDPOINTS = {"T5": 80.0, "T4": 50.0, "T3": 20.0, "T2": 6.0, "T1": 1.5}
    missing_val = [cid for cid in club_ids if cid not in squad_value_raw]
    if missing_val:
        cur.execute("""
            SELECT p.club_id, pm.market_value_tier, COUNT(*) AS cnt
            FROM player_market pm
            JOIN people p ON p.id = pm.person_id
            WHERE p.club_id = ANY(%s)
              AND p.active = true
              AND pm.market_value_tier IS NOT NULL
            GROUP BY p.club_id, pm.market_value_tier
        """, (missing_val,))

        tier_totals: dict[int, float] = defaultdict(float)
        for r in cur.fetchall():
            mid = MVT_MIDPOINTS.get(r["market_value_tier"], 1.0)
            tier_totals[r["club_id"]] += mid * int(r["cnt"])

        for cid, total in tier_totals.items():
            if total > 0 and cid not in squad_value_raw:
                squad_value_raw[cid] = total
                value_sources[cid] = "market_tier"

        print(f"  Pillar 2 (Value): +{len(tier_totals)} from market tier")

    # Remaining: CS Value (director_valuation_meur)
    still_missing_val = [cid for cid in club_ids if cid not in squad_value_raw]
    if still_missing_val:
        cur.execute("""
            SELECT p.club_id,
                   SUM(pm.director_valuation_meur) AS total_meur
            FROM player_market pm
            JOIN people p ON p.id = pm.person_id
            WHERE p.club_id = ANY(%s)
              AND p.active = true
              AND pm.director_valuation_meur IS NOT NULL
              AND pm.director_valuation_meur > 0
            GROUP BY p.club_id
        """, (still_missing_val,))

        for r in cur.fetchall():
            if r["total_meur"] and float(r["total_meur"]) > 0:
                squad_value_raw[r["club_id"]] = float(r["total_meur"])
                value_sources[r["club_id"]] = "cs_value"

        print(f"  Pillar 2 (Value): +{len([c for c in still_missing_val if c in squad_value_raw])} from CS value")

    # ══════════════════════════════════════════════════════════════════════════
    # PILLAR 3: Defensive Intensity (20%)
    # ══════════════════════════════════════════════════════════════════════════

    defense_raw: dict[int, float] = {}
    defense_sources: dict[int, str] = {}

    # AF: DAPM (tackles + interceptions + blocks per appearance) + duel win %
    cur.execute("""
        SELECT p.club_id,
               (SUM(afs.tackles_total) + SUM(COALESCE(afs.interceptions, 0)) + SUM(COALESCE(afs.blocks, 0)))
                   * 1.0 / NULLIF(SUM(afs.appearances), 0) AS dapm,
               SUM(afs.duels_won) * 100.0 / NULLIF(SUM(afs.duels_total), 0) AS duel_win_pct,
               SUM(afs.appearances) AS total_app
        FROM api_football_player_stats afs
        JOIN people p ON p.id = afs.person_id
        WHERE p.club_id = ANY(%s)
          AND afs.season = %s
          AND afs.appearances > 0
        GROUP BY p.club_id
        HAVING SUM(afs.appearances) >= 20
    """, (club_ids, SEASON))

    af_defense = {}
    for r in cur.fetchall():
        if r["dapm"] is not None and r["duel_win_pct"] is not None:
            af_defense[r["club_id"]] = {
                "dapm": float(r["dapm"]),
                "duel_win_pct": float(r["duel_win_pct"]),
            }

    if af_defense:
        # Combine DAPM and duel win pct into a single raw score for ranking
        for cid, v in af_defense.items():
            # Normalize both to similar scales, then blend
            defense_raw[cid] = 0.6 * v["dapm"] + 0.4 * (v["duel_win_pct"] / 10.0)
            defense_sources[cid] = "api_football"

    print(f"  Pillar 3 (Defense): {len(defense_raw)} clubs from AF")

    # Fallback: attribute grades (tackling + interceptions)
    # Store raw values; these will be rank-normalized with AF clubs together later
    missing_def = [cid for cid in club_ids if cid not in defense_raw]
    if missing_def:
        cur.execute("""
            SELECT p.club_id,
                   AVG(ag.stat_score) AS avg_def_grade
            FROM attribute_grades ag
            JOIN people p ON p.id = ag.player_id
            WHERE p.club_id = ANY(%s)
              AND p.active = true
              AND ag.attribute IN ('tackling', 'interceptions')
              AND ag.stat_score IS NOT NULL
            GROUP BY p.club_id
            HAVING COUNT(DISTINCT ag.player_id) >= 5
        """, (missing_def,))

        grade_def = {}
        for r in cur.fetchall():
            grade_def[r["club_id"]] = float(r["avg_def_grade"])

        if grade_def:
            for cid, avg_grade in grade_def.items():
                # Scale attr grade (1-10) to roughly same range as AF defense_raw
                defense_raw[cid] = avg_grade * 1.5  # rough mapping to AF DAPM scale
                defense_sources[cid] = "attr_grades"

        print(f"  Pillar 3 (Defense): +{len(grade_def) if grade_def else 0} from attribute grades")

    # ══════════════════════════════════════════════════════════════════════════
    # PILLAR 4: Buildup Quality (20%)
    # ══════════════════════════════════════════════════════════════════════════

    buildup_raw: dict[int, float] = {}
    buildup_sources: dict[int, str] = {}

    # AF: pass accuracy (minutes-weighted team avg)
    cur.execute("""
        SELECT p.club_id,
               SUM(afs.passes_accuracy * afs.minutes) * 1.0 / NULLIF(SUM(afs.minutes), 0) AS wtd_pass_acc,
               SUM(afs.minutes) AS total_min
        FROM api_football_player_stats afs
        JOIN people p ON p.id = afs.person_id
        WHERE p.club_id = ANY(%s)
          AND afs.season = %s
          AND afs.minutes > 0
          AND afs.passes_accuracy IS NOT NULL
        GROUP BY p.club_id
        HAVING SUM(afs.minutes) >= 500
    """, (club_ids, SEASON))

    af_pass = {}
    for r in cur.fetchall():
        if r["wtd_pass_acc"] is not None:
            af_pass[r["club_id"]] = float(r["wtd_pass_acc"])

    # FBRef: progressive passes p90 (join via player_id_links)
    fbref_prog: dict[int, float] = {}
    cur.execute("""
        SELECT p.club_id,
               SUM(fps.progressive_passes) * 90.0 / NULLIF(SUM(fps.minutes), 0) AS prog_p90
        FROM fbref_player_season_stats fps
        JOIN player_id_links pil ON pil.source = 'fbref' AND pil.external_id = fps.fbref_id
        JOIN people p ON p.id = pil.person_id
        WHERE p.club_id = ANY(%s)
          AND p.active = true
          AND fps.minutes > 0
          AND fps.progressive_passes IS NOT NULL
        GROUP BY p.club_id
        HAVING SUM(fps.minutes) >= 500
    """, (club_ids,))

    for r in cur.fetchall():
        if r["prog_p90"] is not None:
            fbref_prog[r["club_id"]] = float(r["prog_p90"])

    print(f"  Pillar 4 (Buildup): {len(af_pass)} AF pass acc, {len(fbref_prog)} FBRef progressive")

    # Combine pass accuracy + progressive passes into raw buildup score
    if af_pass or fbref_prog:
        all_buildup_ids = set(af_pass.keys()) | set(fbref_prog.keys())

        for cid in all_buildup_ids:
            has_pass = cid in af_pass
            has_prog = cid in fbref_prog
            if has_pass and has_prog:
                # Blend: pass_acc (%) + prog_passes_p90 (normalize to similar range)
                buildup_raw[cid] = af_pass[cid] + fbref_prog[cid] * 5.0
                buildup_sources[cid] = "af_fbref"
            elif has_pass:
                buildup_raw[cid] = af_pass[cid]
                buildup_sources[cid] = "api_football"
            else:
                buildup_raw[cid] = fbref_prog[cid] * 5.0
                buildup_sources[cid] = "fbref"

    # Fallback: pass_accuracy attribute grades
    missing_bu = [cid for cid in club_ids if cid not in buildup_raw]
    if missing_bu:
        cur.execute("""
            SELECT p.club_id,
                   AVG(ag.stat_score) AS avg_pass_grade
            FROM attribute_grades ag
            JOIN people p ON p.id = ag.player_id
            WHERE p.club_id = ANY(%s)
              AND p.active = true
              AND ag.attribute = 'pass_accuracy'
              AND ag.stat_score IS NOT NULL
            GROUP BY p.club_id
            HAVING COUNT(DISTINCT ag.player_id) >= 5
        """, (missing_bu,))

        grade_bu = {}
        for r in cur.fetchall():
            grade_bu[r["club_id"]] = float(r["avg_pass_grade"])

        if grade_bu:
            for cid, avg_grade in grade_bu.items():
                # Scale attr grade (1-10) to roughly same range as pass_accuracy (60-90%)
                buildup_raw[cid] = 60 + avg_grade * 3.0
                buildup_sources[cid] = "attr_grades"

        print(f"  Pillar 4 (Buildup): +{len(grade_bu) if grade_bu else 0} from attribute grades")

    # ══════════════════════════════════════════════════════════════════════════
    # COMPOSITE: Weighted sum + league normalization + confidence
    # ══════════════════════════════════════════════════════════════════════════

    # Rank-normalize each pillar across ALL clubs together (not per-source)
    xg_scores = rank_normalize(xg_diff_raw)
    value_scores = rank_normalize(squad_value_raw)
    defense_scores = rank_normalize(defense_raw)
    buildup_scores = rank_normalize(buildup_raw)

    # Source reliability weights — dampen fallback scores toward 50
    SOURCE_RELIABILITY = {
        "understat": 1.0,
        "api_football_gd": 0.85,
        "squad_overall": 0.50,
        "kaggle": 1.0,
        "market_tier": 0.90,
        "cs_value": 0.80,
        "api_football": 1.0,
        "attr_grades": 0.50,
        "af_fbref": 1.0,
        "fbref": 0.90,
    }

    def dampen(score: float, source: str | None) -> float:
        """Dampen a 0-100 score toward 50 based on source reliability."""
        if source is None:
            return 50.0
        rel = SOURCE_RELIABILITY.get(source, 0.5)
        return 50 + (score - 50) * rel

    results = []
    for cid in club_ids:
        club = clubs[cid]

        # Get pillar scores (default to 50 if missing), dampened by source reliability
        p1 = dampen(xg_scores.get(cid, 50.0), xg_sources.get(cid))
        p2 = dampen(value_scores.get(cid, 50.0), value_sources.get(cid))
        p3 = dampen(defense_scores.get(cid, 50.0), defense_sources.get(cid))
        p4 = dampen(buildup_scores.get(cid, 50.0), buildup_sources.get(cid))

        # Weighted sum
        raw_rating = W_XG * p1 + W_VALUE * p2 + W_DEFENSE * p3 + W_BUILDUP * p4

        # League normalization
        league = club.get("league_name")
        sf = league_strength.get(league, 0.60) if league else 0.60

        # Blend: league-adjusted base, with UEFA club coefficient where available
        league_adjusted = 50 + (raw_rating - 50) * sf
        uefa_coeff = club.get("uefa_coefficient")

        if uefa_coeff and float(uefa_coeff) > 0:
            # UEFA coefficient typically 0-130; normalize to 0-100
            uefa_norm = min(float(uefa_coeff) / 130.0 * 100, 100)
            final_rating = 0.7 * league_adjusted + 0.3 * uefa_norm
        else:
            final_rating = league_adjusted

        # Clamp 0-100
        final_rating = max(0, min(100, final_rating))

        # Confidence score
        confidence = 0.0
        sources = []
        if cid in xg_sources:
            if xg_sources[cid] == "understat":
                confidence += 0.30
                sources.append("understat")
            elif xg_sources[cid] == "api_football_gd":
                confidence += 0.30 * 0.85  # penalty for actual GD vs xG
                sources.append("af_gd")
            else:
                confidence += 0.10
                sources.append("ovr_proxy")

        if cid in value_sources:
            confidence += 0.20
            sources.append(value_sources[cid])

        if cid in defense_sources:
            if defense_sources[cid] == "api_football":
                confidence += 0.25
            else:
                confidence += 0.10
            sources.append(defense_sources[cid])

        if cid in buildup_sources:
            if "fbref" in buildup_sources[cid]:
                confidence += 0.15
            else:
                confidence += 0.10
            sources.append(buildup_sources[cid])

        if uefa_coeff and float(uefa_coeff) > 0:
            confidence += 0.10
            sources.append("uefa")

        confidence = min(confidence, 1.0)

        # Projected GD per match
        projected_gd = (final_rating - 50) / 50 * 2.0

        results.append({
            "club_id": cid,
            "club_name": club["clubname"],
            "power_rating": round(final_rating, 2),
            "projected_gd": round(projected_gd, 3),
            "confidence": round(confidence, 2),
            "xg_diff_score": round(p1, 2),
            "squad_value_score": round(p2, 2),
            "defensive_score": round(p3, 2),
            "buildup_score": round(p4, 2),
            "xg_diff_raw": round(xg_diff_raw.get(cid, 0), 3) if cid in xg_diff_raw else None,
            "squad_value_meur": round(squad_value_raw.get(cid, 0), 2) if cid in squad_value_raw else None,
            "dapm_raw": round(af_defense[cid]["dapm"], 2) if cid in af_defense else None,
            "pass_acc_raw": round(af_pass.get(cid, 0), 2) if cid in af_pass else None,
            "data_sources": sources,
        })

    # Sort by rating desc for display
    results.sort(key=lambda r: r["power_rating"], reverse=True)

    # ── Display ───────────────────────────────────────────────────────────────

    print(f"\n{'Rank':<5} {'Club':<30} {'Rating':>7} {'Conf':>5} {'GD/M':>6} │ {'xG':>5} {'Val':>5} {'Def':>5} {'BU':>5} │ Sources")
    print("─" * 110)
    for i, r in enumerate(results[:50], 1):
        src_str = ", ".join(r["data_sources"][:4])
        print(f"{i:<5} {r['club_name']:<30} {r['power_rating']:>7.2f} {r['confidence']:>5.2f} {r['projected_gd']:>+6.3f} │ "
              f"{r['xg_diff_score']:>5.1f} {r['squad_value_score']:>5.1f} {r['defensive_score']:>5.1f} {r['buildup_score']:>5.1f} │ {src_str}")

    if len(results) > 50:
        print(f"  ... and {len(results) - 50} more clubs")

    # ── Write ─────────────────────────────────────────────────────────────────

    if DRY_RUN:
        print(f"\n  [dry-run] Would write {len(results)} club ratings")
        conn.close()
        return

    written = 0
    for r in results:
        cur.execute("""
            INSERT INTO club_ratings (club_id, season, power_rating, projected_gd, confidence,
                xg_diff_score, squad_value_score, defensive_score, buildup_score,
                xg_diff_raw, squad_value_meur, dapm_raw, pass_acc_raw,
                data_sources, computed_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
            ON CONFLICT (club_id, season)
            DO UPDATE SET
                power_rating = EXCLUDED.power_rating,
                projected_gd = EXCLUDED.projected_gd,
                confidence = EXCLUDED.confidence,
                xg_diff_score = EXCLUDED.xg_diff_score,
                squad_value_score = EXCLUDED.squad_value_score,
                defensive_score = EXCLUDED.defensive_score,
                buildup_score = EXCLUDED.buildup_score,
                xg_diff_raw = EXCLUDED.xg_diff_raw,
                squad_value_meur = EXCLUDED.squad_value_meur,
                dapm_raw = EXCLUDED.dapm_raw,
                pass_acc_raw = EXCLUDED.pass_acc_raw,
                data_sources = EXCLUDED.data_sources,
                computed_at = EXCLUDED.computed_at
        """, (
            r["club_id"], SEASON, r["power_rating"], r["projected_gd"], r["confidence"],
            r["xg_diff_score"], r["squad_value_score"], r["defensive_score"], r["buildup_score"],
            r["xg_diff_raw"], r["squad_value_meur"], r["dapm_raw"], r["pass_acc_raw"],
            r["data_sources"],
        ))
        written += 1

    # Update clubs cache column
    for r in results:
        cur.execute("""
            UPDATE clubs SET power_rating = %s, power_confidence = %s
            WHERE id = %s
        """, (r["power_rating"], r["confidence"], r["club_id"]))

    conn.commit()
    print(f"\n  Written {written} club ratings + updated clubs cache")
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
