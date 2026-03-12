"""
04_refine_players.py — Archetype scoring + enrichment using SACROSANCT models.

Derives / infers:
  1. market_value_tier (1-5) from level / peak + division
  2. archetype — 13 SACROSANCT playing models scored from attribute_grades

The 13 playing models (per SACROSANCT):
  Mental:    Controller, Commander, Creator
  Physical:  Target, Sprinter, Powerhouse
  Tactical:  Cover, Engine, Destroyer
  Technical: Dribbler, Passer, Striker
  Specialist: GK

Archetypes are bare nouns (Controller, not "The Controller").
Model scores are computed from attribute_grades, not assigned.

Usage:
    python pipeline/04_refine_players.py [--dry-run]
"""
from __future__ import annotations

import sys

from config import POSTGRES_DSN

DRY_RUN = "--dry-run" in sys.argv


# ── Domain constants ──────────────────────────────────────────────────────────

TOP_5_LEAGUES = frozenset({
    "Premier League", "LaLiga", "La Liga",
    "Bundesliga", "Serie A", "Ligue 1",
})
TOP_LEAGUES = TOP_5_LEAGUES | frozenset({
    "Primeira Liga", "Eredivisie", "Süper Lig",
    "Premiership", "Belgian Pro League",
})


# ── SACROSANCT: 13 Playing Models ────────────────────────────────────────────

MODEL_ATTRIBUTES: dict[str, list[str]] = {
    # Mental
    "Controller":  ["anticipation", "composure", "decisions", "tempo"],
    "Commander":   ["communication", "concentration", "drive", "leadership"],
    "Creator":     ["creativity", "unpredictability", "vision", "guile"],
    # Physical
    "Target":      ["aerial_duels", "heading", "jumping", "volleys"],
    "Sprinter":    ["acceleration", "balance", "movement", "pace"],
    "Powerhouse":  ["aggression", "duels", "shielding", "throwing"],
    # Tactical
    "Cover":       ["awareness", "discipline", "interceptions", "positioning"],
    "Engine":      ["intensity", "pressing", "stamina", "versatility"],
    "Destroyer":   ["blocking", "clearances", "marking", "tackling"],
    # Technical
    "Dribbler":    ["carries", "first_touch", "skills", "take_ons"],
    "Passer":      ["pass_accuracy", "crossing", "pass_range", "through_balls"],
    "Striker":     ["short_range", "mid_range", "long_range", "penalties"],
    # Specialist
    "GK":          ["agility", "footwork", "handling", "reactions"],
}

# Compound categories (for determining if secondary model adds diversity)
MODEL_COMPOUNDS: dict[str, str] = {
    "Controller": "Mental", "Commander": "Mental", "Creator": "Mental",
    "Target": "Physical", "Sprinter": "Physical", "Powerhouse": "Physical",
    "Cover": "Tactical", "Engine": "Tactical", "Destroyer": "Tactical",
    "Dribbler": "Technical", "Passer": "Technical", "Striker": "Technical",
    "GK": "Specialist",
}

# DB attribute name aliases (typos, casing inconsistencies)
ATTR_ALIASES: dict[str, str] = {
    "takeons": "take_ons",
    "Leadership": "leadership",
    "unpredicability": "unpredictability",
}


# ── Market Value Tier ─────────────────────────────────────────────────────────

def compute_mvt(level, peak, division: str | None) -> int:
    if level:
        q = level
    elif peak:
        q = peak * 0.92
    else:
        q = 0

    if q >= 90:   base = 5
    elif q >= 86: base = 4
    elif q >= 82: base = 3
    elif q >= 78: base = 2
    elif q > 0:   base = 1
    else:         base = 1

    div = division or ""
    if div in TOP_5_LEAGUES:
        base = max(base, 3)
    elif div in TOP_LEAGUES:
        base = max(base, 2)

    return min(base, 5)


# ── Archetype confidence ─────────────────────────────────────────────────────

def archetype_confidence(has_grades: bool, has_scout_grades: bool) -> str:
    if has_grades and has_scout_grades:
        return "high"
    if has_grades:
        return "medium"
    return "low"


# ── Model scoring from attribute_grades ───────────────────────────────────────

def normalize_grades(grades: list[dict]) -> tuple[dict[str, float], bool, bool]:
    """
    Convert attribute_grades rows into {attribute: score_0_100}.
    Prefers scout_grade, falls back to stat_score.

    Canonical scale is 0-10 (per SACROSANCT). Legacy data may use 0-20.
    We detect the scale by checking max values and normalize accordingly.

    Returns (scores_dict, has_any_scout_grade, has_differentiated_data).

    If all stat_scores are identical (e.g. all 10 = default/unfilled),
    the data is undifferentiated and archetype scoring is meaningless.
    """
    result: dict[str, float] = {}
    has_scout = False
    stat_values: set[float] = set()
    raw_scout: list[float] = []
    raw_stat: list[float] = []

    for g in grades:
        scout = g.get("scout_grade")
        stat = g.get("stat_score")
        if scout is not None and scout > 0:
            raw_scout.append(scout)
        if stat is not None and stat > 0:
            raw_stat.append(stat)

    # Detect scale: if any value > 10, data is on 0-20 scale (legacy).
    # If scout data is on 0-20, stat data is too (same import batch).
    all_vals = raw_scout + raw_stat
    max_val = max(all_vals) if all_vals else 10
    scale = 20.0 if max_val > 10 else 10.0

    for g in grades:
        attr = g["attribute"]
        attr = ATTR_ALIASES.get(attr, attr)

        scout = g.get("scout_grade")
        stat = g.get("stat_score")

        if scout is not None and scout > 0:
            result[attr] = (scout / scale) * 100.0
            has_scout = True
        elif stat is not None and stat > 0:
            result[attr] = (stat / scale) * 100.0
            stat_values.add(stat)

    # If no scout grades and all stat_scores are identical, data is undifferentiated
    has_differentiated = has_scout or len(stat_values) > 1

    return result, has_scout, has_differentiated


def score_models(attr_scores: dict[str, float], position: str | None) -> dict[str, float]:
    """Score all 13 SACROSANCT models. Returns {model: score_0_100}."""
    scores = {}
    pos = position or ""

    for model, core_attrs in MODEL_ATTRIBUTES.items():
        vals = [attr_scores.get(a) for a in core_attrs]
        vals = [v for v in vals if v is not None]

        if len(vals) < 2:
            scores[model] = 0.0
            continue

        raw = sum(vals) / len(vals)

        # GK model only meaningful for GKs, and vice versa
        if model == "GK" and pos != "GK":
            raw *= 0.3
        elif model != "GK" and pos == "GK":
            raw *= 0.3

        scores[model] = round(raw, 1)

    return scores


def best_model(scores: dict[str, float], threshold: float = 15.0) -> str | None:
    """
    Return compound archetype (Primary-Secondary) from top two model scores.
    If only one model is above threshold, return just that model.
    Compound format: "Controller-Passer", "GK-Controller", etc.
    """
    if not scores:
        return None
    ranked = sorted(scores.items(), key=lambda x: -x[1])
    if not ranked or ranked[0][1] < threshold:
        return None

    primary = ranked[0][0]
    # Compound archetype: include secondary if it's within 5 points of primary
    # and from a different compound category (Mental/Physical/Tactical/Technical).
    # This captures genuine dual-profile players, not noise.
    if len(ranked) > 1:
        secondary_name, secondary_score = ranked[1]
        gap = ranked[0][1] - secondary_score
        primary_cat = MODEL_COMPOUNDS.get(primary)
        secondary_cat = MODEL_COMPOUNDS.get(secondary_name)
        # Compound if very close scores AND different categories (diverse profile)
        if gap <= 3 and secondary_score >= threshold and primary_cat != secondary_cat:
            return f"{primary}-{secondary_name}"
    return primary


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    import psycopg2
    import psycopg2.extras

    print("04 — Refine Players (SACROSANCT archetype scoring)")
    print("Connecting...")
    conn = psycopg2.connect(POSTGRES_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Load players from normalized tables
    print("Loading players...")
    cur.execute("""
        SELECT
            pe.id,
            pe.name,
            pp.level,
            pp.peak,
            pp.position,
            pp.archetype,
            pp.archetype_confidence,
            pp.profile_tier,
            pm.market_value_tier,
            c."Division" AS division
        FROM people pe
        JOIN player_profiles pp ON pp.person_id = pe.id
        LEFT JOIN player_market pm ON pm.person_id = pe.id
        LEFT JOIN clubs c ON c.id = pe.club_id
    """)
    players = cur.fetchall()
    print(f"  {len(players):,} players loaded.")

    # Load all attribute grades keyed by player_id
    print("Loading attribute grades...")
    cur.execute("SELECT player_id, attribute, scout_grade, stat_score FROM attribute_grades")
    all_grades = cur.fetchall()
    grades_by_player: dict[int, list[dict]] = {}
    for g in all_grades:
        pid = g["player_id"]
        if pid not in grades_by_player:
            grades_by_player[pid] = []
        grades_by_player[pid].append(g)
    print(f"  {len(all_grades):,} grades for {len(grades_by_player):,} players.")

    # Build update plan
    arch_dist: dict[str, int] = {}
    method_dist: dict[str, int] = {"attribute_scored": 0, "undifferentiated": 0, "no_data": 0}
    mvt_changed = arch_changed = 0
    updates: list[tuple] = []

    for p in players:
        pid      = p["id"]
        level    = p["level"]
        peak     = p["peak"]
        division = p["division"]
        position = p["position"]
        cur_arch = p["archetype"]
        cur_mvt  = p["market_value_tier"]

        # ── Market Value Tier
        new_mvt = compute_mvt(level, peak, division)
        if new_mvt != cur_mvt:
            mvt_changed += 1

        # ── Archetype: score from attribute_grades
        new_arch = None
        has_grades = pid in grades_by_player
        has_scout = False

        if has_grades:
            attr_scores, has_scout, has_diff = normalize_grades(grades_by_player[pid])
            if has_diff:
                model_scores = score_models(attr_scores, position)
                new_arch = best_model(model_scores)
                if new_arch:
                    method_dist["attribute_scored"] += 1
                else:
                    method_dist["no_data"] += 1
            else:
                # All stat_scores identical (e.g. all 10) — undifferentiated
                method_dist["undifferentiated"] += 1
        else:
            method_dist["no_data"] += 1

        # GK fallback: if position is GK and no archetype was scored, default to GK
        if not new_arch and position == "GK":
            new_arch = "GK"

        new_conf = archetype_confidence(has_grades, has_scout)

        label = new_arch or "(none)"
        arch_dist[label] = arch_dist.get(label, 0) + 1
        if new_arch != cur_arch:
            arch_changed += 1

        updates.append((pid, new_mvt, new_arch, new_conf))

    # ── Summary
    print(f"\nPlan:")
    print(f"  MVT updated for {mvt_changed:,} players")
    print(f"  Archetype changed for {arch_changed:,} players")
    print(f"\nScoring method:")
    for method, count in sorted(method_dist.items(), key=lambda x: -x[1]):
        print(f"  {method:<20} {count:>6,}")
    print(f"\nArchetype distribution (SACROSANCT models):")
    max_n = max(arch_dist.values()) if arch_dist else 1
    for arch, n in sorted(arch_dist.items(), key=lambda x: -x[1]):
        bar = "█" * round(n / max_n * 30)
        pct = n / len(players) * 100
        print(f"  {arch:<14} {bar:<30} {n:>6,}  ({pct:.1f}%)")

    if DRY_RUN:
        print("\n--dry-run: no writes.")
        conn.rollback()
        conn.close()
        return

    # ── Write (batch updates via temp table for speed)
    print("\nWriting to DB...")

    # Create temp table, bulk insert, then UPDATE FROM
    cur.execute("""
        CREATE TEMP TABLE _refine_batch (
            pid INTEGER PRIMARY KEY,
            mvt INTEGER,
            arch TEXT,
            conf TEXT
        )
    """)

    from psycopg2.extras import execute_values
    BATCH = 2000
    for i in range(0, len(updates), BATCH):
        batch = updates[i:i + BATCH]
        cur.execute("TRUNCATE _refine_batch")
        execute_values(cur, "INSERT INTO _refine_batch (pid, mvt, arch, conf) VALUES %s", batch)

        cur.execute("""
            UPDATE player_market pm
            SET market_value_tier = b.mvt
            FROM _refine_batch b
            WHERE pm.person_id = b.pid
        """)
        cur.execute("""
            UPDATE player_profiles pp
            SET archetype = b.arch,
                archetype_confidence = b.conf,
                archetype_override = NULL
            FROM _refine_batch b
            WHERE pp.person_id = b.pid
        """)
        conn.commit()
        done = min(i + BATCH, len(updates))
        print(f"  {done:,}/{len(updates):,}", end="\r")

    print(f"\nDone. {len(updates):,} rows committed.")
    conn.close()


if __name__ == "__main__":
    main()
