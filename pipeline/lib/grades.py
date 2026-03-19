"""Shared grading utilities for pipeline grade scripts.

Provides position grouping, percentile ranking, score conversion,
and batch grade writing used by scripts 22, 66, and future source graders.

Usage:
    from lib.grades import (
        get_position_group, POSITION_GROUPS,
        compute_positional_percentiles, percentile_to_score_20, percentile_to_score_10,
        per90, pct, safe_float, write_grades,
    )
"""
from __future__ import annotations

import math
from datetime import datetime, timezone

from psycopg2.extras import execute_values


# ── Position grouping ────────────────────────────────────────────────────────

ATTACKER_POS = {"CF", "WF", "AM"}
MIDFIELDER_POS = {"CM", "DM", "WM"}
DEFENDER_POS = {"CD", "WD"}
GK_POS = {"GK"}

POSITION_GROUPS = {
    "attacker": ATTACKER_POS,
    "midfielder": MIDFIELDER_POS,
    "defender": DEFENDER_POS,
    "gk": GK_POS,
}


def get_position_group(position: str | None) -> str | None:
    """Map a SACROSANCT position to a group name."""
    if not position:
        return None
    pos = position.upper().strip()
    for group, positions in POSITION_GROUPS.items():
        if pos in positions:
            return group
    return None


# ── Stat helpers ─────────────────────────────────────────────────────────────

def safe_float(val) -> float | None:
    if val is None:
        return None
    v = float(val)
    if math.isnan(v) or math.isinf(v):
        return None
    return v


def per90(val, minutes: float) -> float | None:
    if val is None or minutes is None or minutes <= 0:
        return None
    v = safe_float(val)
    if v is None:
        return None
    return v / minutes * 90


def pct(numerator, denominator, min_denom: int = 5) -> float | None:
    if not numerator or not denominator or denominator < min_denom:
        return None
    return float(numerator) / float(denominator) * 100


# ── Percentile ranking ───────────────────────────────────────────────────────

def percentile_rank(values: list[tuple]) -> dict:
    """Given [(id, value), ...], return {id: percentile 0-100}.

    Filters out None values. Returns empty dict if fewer than 3 valid entries.
    """
    valid = [(pid, v) for pid, v in values if v is not None]
    if len(valid) < 3:
        return {}
    sorted_vals = sorted(valid, key=lambda x: x[1])
    n = len(sorted_vals)
    return {pid: (i / max(n - 1, 1)) * 100 for i, (pid, _) in enumerate(sorted_vals)}


def percentile_to_score_20(pct_val: float) -> int:
    """Convert 0-100 percentile to 1-20 SACROSANCT scale (used by FBRef)."""
    return max(1, min(20, round(pct_val / 5)))


def percentile_to_score_10(pct_val: float) -> int:
    """Convert 0-100 percentile to 1-10 SACROSANCT scale (used by API-Football)."""
    return max(1, min(10, round(pct_val / 10)))


def compute_positional_percentiles(
    player_metrics: dict[int, dict[str, float]],
    player_positions: dict[int, str | None],
    metric_position_filter: dict[str, set[str]] | None = None,
    score_fn=percentile_to_score_20,
    strength_factors: dict[int, float] | None = None,
) -> dict[int, dict[str, int]]:
    """Compute percentile-based scores within position groups.

    Args:
        player_metrics: {person_id: {metric_name: raw_value}}
        player_positions: {person_id: position_group_name}
        metric_position_filter: {metric_name: {valid_position_groups}}.
            If None, all metrics apply to all groups.
        score_fn: Function to convert percentile (0-100) to integer score.
        strength_factors: {person_id: league_strength_factor} for scaling.
    """
    all_metrics = set()
    for metrics in player_metrics.values():
        all_metrics.update(metrics.keys())

    # Group players by position
    groups: dict[str, list[int]] = {}
    for pid, pg in player_positions.items():
        if pid in player_metrics:
            groups.setdefault(pg or "unknown", []).append(pid)

    results: dict[int, dict[str, int]] = {}

    for metric in all_metrics:
        for group_name, pids in groups.items():
            # Check if this metric applies to this position group
            if metric_position_filter and metric in metric_position_filter:
                if group_name not in metric_position_filter[metric] and group_name != "unknown":
                    continue

            vals = []
            for pid in pids:
                v = player_metrics.get(pid, {}).get(metric)
                if v is not None:
                    vals.append((pid, v))

            if len(vals) < 3:
                continue

            pct_ranks = percentile_rank(vals)
            for pid, pct_val in pct_ranks.items():
                if strength_factors:
                    pct_val *= strength_factors.get(pid, 1.0)
                results.setdefault(pid, {})[metric] = score_fn(pct_val)

    return results


# ── Grade writing ────────────────────────────────────────────────────────────

def build_grade_rows(
    scores: dict[int, dict[str, int]],
    metric_to_attribute: dict[str, str],
    source: str,
    confidence: str = "Medium",
) -> list[dict]:
    """Convert metric scores to attribute_grades rows.

    Args:
        scores: {person_id: {metric_name: score}}
        metric_to_attribute: {metric_name: sacrosanct_attribute_name}
        source: Source identifier (e.g. 'fbref', 'kaggle_euro')
        confidence: Confidence level
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    rows = []
    for pid, metric_scores in scores.items():
        for metric, score in metric_scores.items():
            attr = metric_to_attribute.get(metric)
            if not attr:
                continue
            rows.append({
                "player_id": pid,
                "attribute": attr,
                "stat_score": score,
                "source": source,
                "is_inferred": True,
                "confidence": confidence,
                "updated_at": now_iso,
            })
    return rows


def write_grades(conn, rows: list[dict], source: str, dry_run: bool = False) -> int:
    """Delete old grades for source and write new ones.

    Args:
        conn: psycopg2 connection (not autocommit — will commit)
        rows: List of grade row dicts
        source: Source identifier for DELETE WHERE source = ...
        dry_run: If True, print count and rollback

    Returns:
        Number of rows written.
    """
    if not rows:
        print(f"  No grades to write for source='{source}'")
        return 0

    if dry_run:
        print(f"  [dry-run] Would write {len(rows)} grades (source='{source}')")
        return 0

    cur = conn.cursor()
    cur.execute("DELETE FROM attribute_grades WHERE source = %s", (source,))
    deleted = cur.rowcount
    print(f"  Cleared {deleted:,} old '{source}' grades")

    BATCH = 500
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        execute_values(cur, """
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

    conn.commit()
    print(f"  Written {len(rows):,} grades (source='{source}')")
    return len(rows)
