"""
42_dof_valuations.py — Run DoF-anchored valuations for players with DoF assessments.

Queries all players with dof_assessments.is_current = true,
loads full player profile, runs valuation in DOF_ANCHOR mode,
and writes results to player_valuations.

Usage:
    python 42_dof_valuations.py                    # all assessed players
    python 42_dof_valuations.py --player 123       # single player
    python 42_dof_valuations.py --dry-run          # preview without writing
    python 42_dof_valuations.py --force            # overwrite existing
"""
import argparse
import sys
from datetime import datetime, timezone

from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from supabase import create_client
from config import POSTGRES_DSN, SUPABASE_URL, SUPABASE_SERVICE_KEY
from valuation_core.data_loader import load_player_profile, load_dof_assessment
from valuation_core.models.ensemble import run_valuation
from valuation_core.types import ValuationMode

# ── Argument parsing ───────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Run DoF-anchored valuations")
parser.add_argument("--player", type=str, default=None, help="Single person_id")
parser.add_argument("--limit", type=int, default=None, help="Max players")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--force", action="store_true")
args = parser.parse_args()

# ── Connections ────────────────────────────────────────────────────────────────

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

if not POSTGRES_DSN:
    print("ERROR: Set POSTGRES_DSN in .env")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def main():
    print("DoF-Anchored Valuation Engine")
    print(f"  Mode: dof_anchor")
    print(f"  Dry run: {args.dry_run}")
    print(f"  Force: {args.force}")

    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    # Find players with current DoF assessments
    where_clauses = ["da.is_current = true"]
    params = []

    if args.player:
        where_clauses.append("da.person_id = %s")
        params.append(int(args.player))

    if not args.force:
        where_clauses.append("""
            NOT EXISTS (
                SELECT 1 FROM player_valuations pv
                WHERE pv.person_id = da.person_id
                AND pv.mode = 'dof_anchor'
            )
        """)

    where = " AND ".join(where_clauses)
    limit_clause = f"LIMIT {args.limit}" if args.limit else ""

    cur.execute(f"""
        SELECT da.person_id, p.name,
               da.worth_any_team_meur, da.worth_right_team_meur,
               da.confidence
        FROM dof_assessments da
        JOIN people p ON p.id = da.person_id
        WHERE {where}
        ORDER BY da.worth_any_team_meur DESC NULLS LAST
        {limit_clause}
    """, params)

    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    players = [dict(zip(cols, r)) for r in rows]

    print(f"\n  Found {len(players)} players with DoF assessments")

    if not players:
        print("  Nothing to do.")
        return

    mode = ValuationMode.DOF_ANCHOR
    results = []
    errors = 0

    for p in players:
        pid = p["person_id"]
        name = p["name"]

        try:
            profile = load_player_profile(pid, conn)
            if not profile:
                print(f"  SKIP {name} (#{pid}): no profile")
                continue

            dof = load_dof_assessment(pid, conn)
            if not dof:
                print(f"  SKIP {name} (#{pid}): no DoF assessment")
                continue

            response = run_valuation(profile, None, mode, dof_assessment=dof)

            results.append({
                "person_id": pid,
                "name": name,
                "position": profile.position,
                "age": profile.age,
                "central": response.market_value.central,
                "p10": response.market_value.p10,
                "p90": response.market_value.p90,
                "use_value": response.use_value.central if response.use_value else None,
                "confidence": dof.confidence,
                "response": response,
            })
        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"  ERROR {name} (#{pid}): {e}")

    # Display results
    print(f"\n  Valued: {len(results)}  Errors: {errors}")

    if results:
        print(f"\n  {'Name':<25} {'Pos':4} {'Age':>3} {'P10':>10} {'P50':>10} {'P90':>10} {'UseVal':>10} {'Conf':>10}")
        print("  " + "-" * 88)
        for r in sorted(results, key=lambda x: x["central"], reverse=True):
            age_str = str(r["age"]) if r["age"] else "–"
            uv_str = f"€{r['use_value']/1e6:.0f}m" if r["use_value"] else "–"
            print(f"  {r['name']:<25} {r['position'] or '–':4} {age_str:>3} "
                  f"€{r['p10']/1e6:>7.1f}m €{r['central']/1e6:>7.1f}m "
                  f"€{r['p90']/1e6:>7.1f}m {uv_str:>10} {r['confidence']:>10}")

    # Write to database
    if not args.dry_run and results:
        written = 0
        now_iso = datetime.now(timezone.utc).isoformat()

        for r in results:
            resp = r["response"]
            mv = resp.market_value
            uv = resp.use_value

            row_data = {
                "person_id": r["person_id"],
                "market_value_p10": mv.p10,
                "market_value_p25": mv.p25,
                "market_value_p50": mv.central,
                "market_value_p75": mv.p75,
                "market_value_p90": mv.p90,
                "use_value_central": uv.central if uv else None,
                "contextual_fit_score": uv.contextual_fit_score if uv else None,
                "system_archetype_fit": uv.contextual_fit_breakdown.system_archetype_fit if uv else None,
                "system_threshold_fit": uv.contextual_fit_breakdown.system_threshold_fit if uv else None,
                "system_personality_fit": uv.contextual_fit_breakdown.system_personality_fit if uv else None,
                "system_tag_compatibility": uv.contextual_fit_breakdown.system_tag_compatibility if uv else None,
                "squad_gap_fill": uv.contextual_fit_breakdown.squad_gap_fill if uv else None,
                "scout_profile_pct": resp.decomposition.scout_profile_contribution,
                "performance_data_pct": resp.decomposition.performance_data_contribution,
                "contract_age_pct": resp.decomposition.contract_age_contribution,
                "market_context_pct": resp.decomposition.market_context_contribution,
                "personality_adj_pct": resp.decomposition.personality_adjustment,
                "style_fit_adj_pct": resp.decomposition.playing_style_fit_adjustment,
                "profile_confidence": resp.confidence.profile_confidence,
                "data_coverage": resp.confidence.data_coverage,
                "overall_confidence": resp.confidence.overall_confidence,
                "band_width_ratio": resp.confidence.band_width_ratio,
                "disagreement_flag": resp.disagreement_flag,
                "stale_profile": resp.stale_profile,
                "low_data_warning": resp.low_data_warning,
                "personality_risk_flags": resp.personality_risk_flags or [],
                "style_risk_flags": resp.style_risk_flags or [],
                "mode": "dof_anchor",
                "target_position": r["position"],
                "target_system": None,
                "model_version": "v1.0",
                "narrative": resp.narrative,
                "evaluated_at": now_iso,
            }

            if resp.disagreement:
                row_data["scout_anchored_value"] = resp.disagreement.scout_anchored_value
                row_data["data_implied_value"] = resp.disagreement.data_implied_value
                row_data["divergent_features"] = resp.disagreement.divergent_features
                row_data["disagreement_narrative"] = resp.disagreement.narrative

            sb.table("player_valuations").insert(row_data).execute()
            written += 1

        print(f"\n  Wrote {written} DoF-anchored valuations to player_valuations")
    elif args.dry_run:
        print(f"\n  [dry-run] Would write {len(results)} valuations")

    cur.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
