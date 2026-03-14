"""
41_valuation_engine.py — Run transfer valuations for players via the valuation engine.

Reads player profiles from Supabase, runs through the 3-layer valuation stack,
and writes results to player_valuations table.

Usage:
    python 41_valuation_engine.py                        # all players with profiles
    python 41_valuation_engine.py --player 123           # single player
    python 41_valuation_engine.py --limit 50             # first 50 players
    python 41_valuation_engine.py --mode balanced        # override λ mode
    python 41_valuation_engine.py --system gegenpress    # evaluate against a system
    python 41_valuation_engine.py --dry-run              # preview without writing
    python 41_valuation_engine.py --force                # overwrite existing valuations
"""
import argparse
import sys
from datetime import datetime, timezone

# Add repo root to path for imports
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from supabase import create_client
from config import POSTGRES_DSN, SUPABASE_URL, SUPABASE_SERVICE_KEY
from valuation_core.data_loader import load_player_profile
from valuation_core.models.ensemble import run_valuation
from valuation_core.types import (
    ClubContext,
    EvaluationContext,
    ValuationMode,
)

# ── Argument parsing ───────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Run transfer valuations")
parser.add_argument("--player", type=str, default=None, help="Single person_id")
parser.add_argument("--limit", type=int, default=None, help="Max players")
parser.add_argument("--mode", type=str, default="scout_dominant",
                    choices=["scout_dominant", "balanced", "data_dominant"])
parser.add_argument("--system", type=str, default=None,
                    help="Tactical system for contextual fit")
parser.add_argument("--position", type=str, default=None,
                    help="Target position override")
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
    print("Transfer Valuation Engine")
    print(f"  Mode: {args.mode}")
    print(f"  System: {args.system or 'none (market value only)'}")
    print(f"  Dry run: {args.dry_run}")
    print(f"  Force: {args.force}")

    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    # Find players to value
    where_clauses = ["pp.position IS NOT NULL"]
    params = []

    if args.player:
        where_clauses.append("p.id = %s")
        params.append(int(args.player))

    if not args.force:
        where_clauses.append("""
            NOT EXISTS (
                SELECT 1 FROM player_valuations pv
                WHERE pv.person_id = p.id
                AND pv.mode = %s
            )
        """)
        params.append(args.mode)

    where = " AND ".join(where_clauses)
    limit_clause = f"LIMIT {args.limit}" if args.limit else ""

    cur.execute(f"""
        SELECT p.id, p.name
        FROM people p
        JOIN player_profiles pp ON pp.person_id = p.id
        WHERE {where}
        ORDER BY pp.level DESC NULLS LAST
        {limit_clause}
    """, params)

    rows = cur.fetchall()
    print(f"\n  Found {len(rows)} players to value")

    if not rows:
        print("  Nothing to do.")
        return

    # Build context if system specified
    context = None
    if args.system:
        context = EvaluationContext(
            buying_club=ClubContext(financial_tier="medium", objective="europe"),
            target_position=args.position or "CM",  # will be overridden per player
            target_system=args.system,
        )

    mode = ValuationMode(args.mode)
    results = []
    errors = 0

    for row in rows:
        pid = row["id"]
        name = row["name"]

        try:
            profile = load_player_profile(pid, conn)
            if not profile:
                continue

            # Use player's position for context if not overridden
            if context and not args.position:
                context.target_position = profile.position or "CM"

            response = run_valuation(profile, context, mode)

            results.append({
                "person_id": pid,
                "name": name,
                "position": profile.position,
                "age": profile.age,
                "central": response.market_value.central,
                "p10": response.market_value.p10,
                "p90": response.market_value.p90,
                "confidence": response.confidence.overall_confidence,
                "fit": response.use_value.contextual_fit_score if response.use_value else None,
                "response": response,
            })
        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"  ERROR {name} (#{pid}): {e}")

    # Display results
    print(f"\n  Valued: {len(results)}  Errors: {errors}")

    if results:
        top = sorted(results, key=lambda x: x["central"], reverse=True)[:20]
        print(f"\n  {'Name':<25} {'Pos':4} {'Age':>3} {'P10':>10} {'P50':>10} {'P90':>10} {'Conf':>6} {'Fit':>5}")
        print("  " + "-" * 80)
        for r in top:
            fit_str = f"{r['fit']:.2f}" if r['fit'] is not None else "–"
            age_str = str(r['age']) if r['age'] else "–"
            print(f"  {r['name']:<25} {r['position'] or '–':4} {age_str:>3} "
                  f"€{r['p10']/1e6:>7.1f}m €{r['central']/1e6:>7.1f}m "
                  f"€{r['p90']/1e6:>7.1f}m {r['confidence']:>6} {fit_str:>5}")

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
                "mode": args.mode,
                "target_position": r["position"],
                "target_system": args.system,
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

        print(f"\n  Wrote {written} valuations to player_valuations")
    elif args.dry_run:
        print(f"\n  [dry-run] Would write {len(results)} valuations")

    cur.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
