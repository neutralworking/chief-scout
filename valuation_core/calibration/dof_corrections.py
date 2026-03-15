"""
DoF correction factors — learns from DoF assessments to improve the standard engine.

How it works:
  1. Load all current DoF assessments
  2. Run the standard engine on each assessed player
  3. Compare engine output vs DoF valuation → per-player residual
  4. Decompose residuals into learnable correction factors:
     - Position-level bias (engine systematically over/under-values a position)
     - Commercial multiplier (DoF commercial score → value adjustment)
     - Availability discount (DoF availability score → buyer pool depth)
     - Context premium by archetype (how context-dependent each archetype is)
  5. Store factors as a CorrectionSet that can be applied to any valuation

The correction set is recomputed whenever DoF assessments change (via
`compute_corrections(conn)`) and cached in memory for the session.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

from valuation_core.data_loader import load_player_profile, load_dof_assessment
from valuation_core.models.ability_model import estimate_ability
from valuation_core.models.market_model import estimate_market_value
from valuation_core.types import DofAssessment, PlayerProfile, ValuationMode


@dataclass
class CorrectionSet:
    """Learned correction factors from DoF assessments."""

    # Per-position multiplicative bias: engine_value × factor ≈ dof_value
    position_bias: dict[str, float] = field(default_factory=dict)

    # Commercial multiplier curve: commercial_score → multiplier
    # Learned from DoF commercial scores vs valuation residuals
    commercial_curve: dict[int, float] = field(default_factory=dict)

    # Availability discount curve: availability_score → multiplier
    availability_curve: dict[int, float] = field(default_factory=dict)

    # Context premium by primary archetype: archetype → typical right/any ratio
    context_premium: dict[str, float] = field(default_factory=dict)

    # Global bias (median engine/dof ratio across all assessed players)
    global_bias: float = 1.0

    # How many assessments this was learned from
    n_assessments: int = 0

    # Per-player residuals for diagnostics
    residuals: list[dict] = field(default_factory=list)


def compute_corrections(conn) -> CorrectionSet:
    """
    Compute correction factors from all current DoF assessments.

    Loads each assessed player, runs the standard engine, compares
    against DoF valuations, and derives systematic correction factors.
    """
    import psycopg2.extras

    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cur.execute("""
        SELECT da.person_id, p.name
        FROM dof_assessments da
        JOIN people p ON p.id = da.person_id
        WHERE da.is_current = true
    """)
    rows = cur.fetchall()
    cur.close()

    if not rows:
        return CorrectionSet()

    # Collect per-player comparisons
    comparisons: list[dict] = []

    for row in rows:
        pid = row["person_id"]
        name = row["name"]

        profile = load_player_profile(pid, conn)
        dof = load_dof_assessment(pid, conn)
        if not profile or not dof:
            continue
        if not dof.worth_any_team_meur or dof.worth_any_team_meur <= 0:
            continue

        try:
            ability = estimate_ability(profile)
            result = estimate_market_value(profile, ability, ValuationMode.SCOUT_DOMINANT)
            engine_central = result["market_value"].central
        except Exception:
            continue

        dof_central = dof.worth_any_team_meur * 1_000_000
        dof_use = dof.worth_right_team_meur * 1_000_000

        # Ratio: how much the engine needs to be corrected
        # ratio < 1 means engine overvalues, > 1 means engine undervalues
        ratio = dof_central / max(engine_central, 100_000)
        context_ratio = dof_use / max(dof_central, 100_000)

        comparisons.append({
            "person_id": pid,
            "name": name,
            "position": profile.position,
            "archetype": profile.primary_archetype,
            "level": profile.level,
            "age": profile.age,
            "engine_central": engine_central,
            "dof_central": dof_central,
            "dof_use": dof_use,
            "ratio": ratio,
            "context_ratio": context_ratio,
            "commercial": dof.commercial,
            "availability": dof.availability,
            "personality": dof.personality,
            "confidence": dof.confidence,
        })

    if not comparisons:
        return CorrectionSet()

    # ── Global bias ─────────────────────────────────────────────────────────
    ratios = [c["ratio"] for c in comparisons]
    global_bias = _median(ratios)

    # ── Position bias ───────────────────────────────────────────────────────
    # Group by position, compute median ratio per position
    position_bias: dict[str, float] = {}
    by_position: dict[str, list[float]] = {}
    for c in comparisons:
        pos = c["position"] or "CM"
        by_position.setdefault(pos, []).append(c["ratio"])
    for pos, pos_ratios in by_position.items():
        raw_bias = _median(pos_ratios)
        # Regress toward global bias when sample is small
        # n=1: 50% weight to position, 50% to global
        # n=3+: 90%+ weight to position
        n = len(pos_ratios)
        weight = n / (n + 1)  # 1→0.5, 2→0.67, 3→0.75, 5→0.83
        position_bias[pos] = raw_bias * weight + global_bias * (1 - weight)

    # ── Commercial curve ────────────────────────────────────────────────────
    # For each commercial score, compute average residual AFTER position bias.
    # Clamp individual residuals to [0.3, 3.0] to prevent outliers (e.g. Messi
    # at 38 where engine says €5m but DoF says €100m) from distorting the curve.
    commercial_curve: dict[int, float] = {}
    by_commercial: dict[int, list[float]] = {}
    for c in comparisons:
        pos_correction = position_bias.get(c["position"] or "CM", global_bias)
        corrected_engine = c["engine_central"] * pos_correction
        residual = c["dof_central"] / max(corrected_engine, 100_000)
        residual = max(0.3, min(3.0, residual))  # clamp outliers
        by_commercial.setdefault(c["commercial"], []).append(residual)

    for score, residuals in by_commercial.items():
        commercial_curve[score] = _median(residuals)

    # Interpolate missing scores
    commercial_curve = _interpolate_curve(commercial_curve, 1, 10, default=1.0)

    # ── Availability curve ──────────────────────────────────────────────────
    # Availability primarily affects the "any team" value.
    # Same outlier clamping as commercial.
    availability_curve: dict[int, float] = {}
    by_avail: dict[int, list[float]] = {}
    for c in comparisons:
        pos_correction = position_bias.get(c["position"] or "CM", global_bias)
        comm_correction = commercial_curve.get(c["commercial"], 1.0)
        corrected_engine = c["engine_central"] * pos_correction * comm_correction
        residual = c["dof_central"] / max(corrected_engine, 100_000)
        residual = max(0.3, min(3.0, residual))  # clamp outliers
        by_avail.setdefault(c["availability"], []).append(residual)

    for score, residuals in by_avail.items():
        availability_curve[score] = _median(residuals)

    availability_curve = _interpolate_curve(availability_curve, 1, 10, default=1.0)

    # ── Context premium by archetype ────────────────────────────────────────
    context_premium: dict[str, float] = {}
    by_archetype: dict[str, list[float]] = {}
    for c in comparisons:
        arch = c["archetype"] or "unknown"
        by_archetype.setdefault(arch, []).append(c["context_ratio"])
    for arch, premiums in by_archetype.items():
        context_premium[arch] = _median(premiums)

    # Build residuals for diagnostics
    residuals = []
    for c in comparisons:
        pos_corr = position_bias.get(c["position"] or "CM", global_bias)
        comm_corr = commercial_curve.get(c["commercial"], 1.0)
        avail_corr = availability_curve.get(c["availability"], 1.0)
        corrected = c["engine_central"] * pos_corr * comm_corr * avail_corr
        residuals.append({
            "name": c["name"],
            "position": c["position"],
            "engine": c["engine_central"],
            "dof": c["dof_central"],
            "corrected": corrected,
            "raw_error_pct": round((c["engine_central"] - c["dof_central"]) / c["dof_central"] * 100, 1),
            "corrected_error_pct": round((corrected - c["dof_central"]) / c["dof_central"] * 100, 1),
        })

    return CorrectionSet(
        position_bias=position_bias,
        commercial_curve=commercial_curve,
        availability_curve=availability_curve,
        context_premium=context_premium,
        global_bias=global_bias,
        n_assessments=len(comparisons),
        residuals=residuals,
    )


def apply_corrections(
    engine_value: float,
    profile: PlayerProfile,
    corrections: CorrectionSet,
    dof: DofAssessment | None = None,
) -> float:
    """
    Apply learned DoF corrections to a standard engine valuation.

    For assessed players: uses their own DoF scores for commercial/availability.
    For non-assessed players: applies only position bias and global bias
    (commercial/availability corrections require DoF scores to exist).
    """
    if corrections.n_assessments == 0:
        return engine_value

    # Position bias
    pos = profile.position or "CM"
    pos_mult = corrections.position_bias.get(pos, corrections.global_bias)

    corrected = engine_value * pos_mult

    # Commercial + availability corrections only if we have DoF scores
    if dof:
        comm_mult = corrections.commercial_curve.get(dof.commercial, 1.0)
        avail_mult = corrections.availability_curve.get(dof.availability, 1.0)
        corrected *= comm_mult * avail_mult

    return corrected


def print_correction_report(corrections: CorrectionSet) -> None:
    """Print a human-readable report of the learned correction factors."""
    print(f"\n  DoF Calibration Report ({corrections.n_assessments} assessments)")
    print("  " + "=" * 70)

    print(f"\n  Global bias: {corrections.global_bias:.3f}x")
    if corrections.global_bias < 0.9:
        print("    → Engine systematically OVERVALUES (DoF says worth less)")
    elif corrections.global_bias > 1.1:
        print("    → Engine systematically UNDERVALUES (DoF says worth more)")
    else:
        print("    → Engine roughly calibrated")

    print(f"\n  Position bias:")
    for pos in ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"]:
        if pos in corrections.position_bias:
            bias = corrections.position_bias[pos]
            direction = "over" if bias < 0.95 else "under" if bias > 1.05 else "ok"
            print(f"    {pos:3s}  {bias:.3f}x  ({direction})")

    print(f"\n  Commercial curve (DoF score → multiplier):")
    for score in range(1, 11):
        mult = corrections.commercial_curve.get(score, 1.0)
        bar = "█" * int(mult * 10) + "░" * (15 - int(mult * 10))
        print(f"    {score:2d}/10  {mult:.3f}x  {bar}")

    print(f"\n  Availability curve (DoF score → multiplier):")
    for score in range(1, 11):
        mult = corrections.availability_curve.get(score, 1.0)
        bar = "█" * int(mult * 10) + "░" * (15 - int(mult * 10))
        print(f"    {score:2d}/10  {mult:.3f}x  {bar}")

    if corrections.context_premium:
        print(f"\n  Context premium by archetype (right_team / any_team):")
        for arch, prem in sorted(corrections.context_premium.items(),
                                  key=lambda x: x[1], reverse=True):
            print(f"    {arch:<20s}  {prem:.2f}x")

    if corrections.residuals:
        print(f"\n  Per-player residuals:")
        print(f"    {'Name':<25s} {'Pos':4s} {'Engine':>10s} {'DoF':>10s} {'Corrected':>10s} {'Raw%':>7s} {'Fix%':>7s}")
        print("    " + "-" * 78)
        for r in sorted(corrections.residuals, key=lambda x: abs(x["raw_error_pct"]), reverse=True):
            print(f"    {r['name']:<25s} {r['position'] or '–':4s} "
                  f"€{r['engine']/1e6:>7.1f}m €{r['dof']/1e6:>7.1f}m "
                  f"€{r['corrected']/1e6:>7.1f}m {r['raw_error_pct']:>+6.1f}% {r['corrected_error_pct']:>+6.1f}%")


# ── Helpers ─────────────────────────────────────────────────────────────────

def _median(values: list[float]) -> float:
    if not values:
        return 1.0
    s = sorted(values)
    n = len(s)
    if n % 2 == 1:
        return s[n // 2]
    return (s[n // 2 - 1] + s[n // 2]) / 2


def _interpolate_curve(
    known: dict[int, float], lo: int, hi: int, default: float = 1.0,
) -> dict[int, float]:
    """Fill in missing integer keys by linear interpolation between known points."""
    if not known:
        return {i: default for i in range(lo, hi + 1)}

    result: dict[int, float] = {}
    sorted_keys = sorted(known.keys())

    for i in range(lo, hi + 1):
        if i in known:
            result[i] = known[i]
        else:
            # Find nearest known points below and above
            below = [k for k in sorted_keys if k < i]
            above = [k for k in sorted_keys if k > i]
            if below and above:
                k_lo, k_hi = below[-1], above[0]
                t = (i - k_lo) / (k_hi - k_lo)
                result[i] = known[k_lo] + t * (known[k_hi] - known[k_lo])
            elif below:
                result[i] = known[below[-1]]
            elif above:
                result[i] = known[above[0]]
            else:
                result[i] = default

    return result
