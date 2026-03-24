"""
69_fixture_predictions.py — Compute predicted scores for upcoming fixtures.

Uses a Poisson model based on club_ratings.power_rating (domestic/continental)
or nations.fifa_points / otp_ideal_squads.strength (international).

Writes predicted_home_goals, predicted_away_goals, home_win_prob, draw_prob,
away_win_prob, prediction_confidence to the fixtures table.

Usage:
    python 69_fixture_predictions.py
    python 69_fixture_predictions.py --dry-run
    python 69_fixture_predictions.py --force          # recompute all
    python 69_fixture_predictions.py --fixture-id 123 # single fixture
"""

import argparse
import math
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))

from lib.db import require_conn, get_dict_cursor

# ── Args ──────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Compute fixture predictions")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--force", action="store_true", help="Recompute existing predictions")
parser.add_argument("--fixture-id", type=int, help="Single fixture ID to process")
args = parser.parse_args()

DRY_RUN = args.dry_run

# ── Constants ─────────────────────────────────────────────────────────────────

DEFAULT_AVG_GOALS = 1.35
HOME_ADV = {"domestic": 1.18, "continental": 1.10, "international": 1.08}
MAX_GOALS = 7
RHO = -0.04  # Dixon-Coles low-score correction


# ── Poisson math ──────────────────────────────────────────────────────────────

def factorial(n):
    if n <= 1:
        return 1
    r = 1
    for i in range(2, n + 1):
        r *= i
    return r


def poisson_pmf(k, lam):
    if lam <= 0:
        return 1.0 if k == 0 else 0.0
    return (lam ** k) * math.exp(-lam) / factorial(k)


def dc_correction(h, a, lam_h, lam_a, rho):
    if h == 0 and a == 0:
        return 1 - lam_h * lam_a * rho
    if h == 0 and a == 1:
        return 1 + lam_h * rho
    if h == 1 and a == 0:
        return 1 + lam_a * rho
    if h == 1 and a == 1:
        return 1 - rho
    return 1.0


def power_to_lambda(team_power, opp_power, avg_goals, is_home, home_adv):
    tp = max(5, min(95, team_power))
    op = max(5, min(95, opp_power))
    attack = tp / 50.0
    defense_weak = (100 - op) / 50.0
    lam = avg_goals * math.sqrt(attack * defense_weak)
    if is_home:
        lam *= home_adv
    return max(0.2, min(4.0, lam))


def fifa_points_to_power(points):
    """Convert FIFA ranking points (800-1900) to 0-100 power scale."""
    clamped = max(800, min(1900, points or 1000))
    return ((clamped - 800) / 1100) * 80 + 10


def predict(home_power, away_power, comp_type):
    """Compute prediction from team powers."""
    avg_goals = DEFAULT_AVG_GOALS
    home_adv = HOME_ADV.get(comp_type, 1.15)

    lam_h = power_to_lambda(home_power, away_power, avg_goals, True, home_adv)
    lam_a = power_to_lambda(away_power, home_power, avg_goals, False, 1.0)

    total = 0
    matrix = {}
    for h in range(MAX_GOALS):
        for a in range(MAX_GOALS):
            p = poisson_pmf(h, lam_h) * poisson_pmf(a, lam_a) * dc_correction(h, a, lam_h, lam_a, RHO)
            matrix[(h, a)] = p
            total += p

    # Normalize
    for k in matrix:
        matrix[k] /= total

    # W/D/L
    hw = sum(p for (h, a), p in matrix.items() if h > a)
    dr = sum(p for (h, a), p in matrix.items() if h == a)
    aw = sum(p for (h, a), p in matrix.items() if h < a)

    # Most likely score
    best_score = max(matrix, key=matrix.get)

    # Confidence: based on power differential
    power_diff = abs(home_power - away_power)
    confidence = min(1.0, power_diff / 40) * 0.4 + 0.4  # 0.4-0.8 range

    return {
        "predicted_home_goals": round(lam_h, 2),
        "predicted_away_goals": round(lam_a, 2),
        "home_win_prob": round(hw, 3),
        "draw_prob": round(dr, 3),
        "away_win_prob": round(aw, 3),
        "prediction_confidence": round(confidence, 2),
        "most_likely": f"{best_score[0]}-{best_score[1]}",
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    conn = require_conn()
    cur = get_dict_cursor(conn)

    print("Fixture Predictions — Poisson Model")
    print(f"  Mode: {'DRY RUN' if DRY_RUN else 'LIVE'}")

    # ── Load club power ratings ─────────────────────────────────────────────
    cur.execute("SELECT club_id, power_rating, confidence FROM club_ratings WHERE power_rating IS NOT NULL")
    club_power = {r["club_id"]: r for r in cur.fetchall()}
    print(f"  {len(club_power)} club ratings loaded")

    # ── Load nation strengths ───────────────────────────────────────────────
    cur.execute("SELECT id, fifa_points FROM nations WHERE fifa_points IS NOT NULL")
    nation_points = {r["id"]: r["fifa_points"] for r in cur.fetchall()}
    print(f"  {len(nation_points)} nation FIFA points loaded")

    # otp_ideal_squads strength as fallback
    cur.execute("SELECT nation_id, strength FROM otp_ideal_squads WHERE strength IS NOT NULL")
    nation_squad_strength = {r["nation_id"]: r["strength"] for r in cur.fetchall()}
    print(f"  {len(nation_squad_strength)} nation squad strengths loaded")

    # ── Load upcoming fixtures ──────────────────────────────────────────────
    where_clauses = ["status IN ('SCHEDULED', 'TIMED')"]
    params = []

    if args.fixture_id:
        where_clauses.append("id = %s")
        params.append(args.fixture_id)
    elif not args.force:
        where_clauses.append("predictions_computed_at IS NULL")

    where_sql = " AND ".join(where_clauses)
    cur.execute(f"""
        SELECT id, competition_type, home_club_id, away_club_id,
               home_nation_id, away_nation_id, home_team, away_team
        FROM fixtures
        WHERE {where_sql}
        ORDER BY utc_date ASC
    """, params)
    fixtures = cur.fetchall()
    print(f"  {len(fixtures)} fixtures to predict\n")

    computed = 0
    skipped = 0

    for fix in fixtures:
        fid = fix["id"]
        ctype = fix["competition_type"] or "domestic"
        home_power = None
        away_power = None

        if ctype == "international":
            # Use FIFA points → power
            h_nid = fix["home_nation_id"]
            a_nid = fix["away_nation_id"]
            if h_nid and h_nid in nation_points:
                home_power = fifa_points_to_power(nation_points[h_nid])
            elif h_nid and h_nid in nation_squad_strength:
                home_power = max(10, min(90, nation_squad_strength[h_nid]))
            if a_nid and a_nid in nation_points:
                away_power = fifa_points_to_power(nation_points[a_nid])
            elif a_nid and a_nid in nation_squad_strength:
                away_power = max(10, min(90, nation_squad_strength[a_nid]))
        else:
            # Club power ratings
            h_cid = fix["home_club_id"]
            a_cid = fix["away_club_id"]
            if h_cid and h_cid in club_power:
                home_power = float(club_power[h_cid]["power_rating"])
            if a_cid and a_cid in club_power:
                away_power = float(club_power[a_cid]["power_rating"])

        if home_power is None or away_power is None:
            skipped += 1
            if DRY_RUN:
                print(f"  SKIP  {fix['home_team']} vs {fix['away_team']} — missing power data")
            continue

        pred = predict(home_power, away_power, ctype)

        if DRY_RUN:
            print(f"  {fix['home_team']} vs {fix['away_team']}  →  "
                  f"{pred['most_likely']}  "
                  f"(H:{pred['home_win_prob']:.0%} D:{pred['draw_prob']:.0%} A:{pred['away_win_prob']:.0%})  "
                  f"xG:{pred['predicted_home_goals']}-{pred['predicted_away_goals']}")
        else:
            cur.execute("""
                UPDATE fixtures SET
                    predicted_home_goals = %s,
                    predicted_away_goals = %s,
                    home_win_prob = %s,
                    draw_prob = %s,
                    away_win_prob = %s,
                    prediction_confidence = %s,
                    predictions_computed_at = %s
                WHERE id = %s
            """, (
                pred["predicted_home_goals"],
                pred["predicted_away_goals"],
                pred["home_win_prob"],
                pred["draw_prob"],
                pred["away_win_prob"],
                pred["prediction_confidence"],
                datetime.now(timezone.utc),
                fid,
            ))
            computed += 1

    if not DRY_RUN:
        conn.commit()

    print(f"\n── Summary ──")
    print(f"  Computed: {computed}")
    print(f"  Skipped:  {skipped}")

    conn.close()


if __name__ == "__main__":
    main()
