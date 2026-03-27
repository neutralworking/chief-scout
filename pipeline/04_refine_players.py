"""
04_refine_players.py — Archetype scoring + personality inference using SACROSANCT.

Derives / infers:
  1. market_value_tier (1-5) from level / peak + division
  2. archetype — 13 SACROSANCT playing models scored from attribute_grades
  3. personality — 4-dimension scores (ei/sn/tf/jp) inferred from
     attribute_grades + career_metrics + news_sentiment_agg

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
from lib.models import MODEL_ATTRIBUTES, ATTR_ALIASES

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


# MODEL_ATTRIBUTES imported from lib.models

# Compound categories (for determining if secondary model adds diversity)
MODEL_COMPOUNDS: dict[str, str] = {
    "Controller": "Mental", "Commander": "Mental", "Creator": "Mental",
    "Target": "Physical", "Sprinter": "Physical", "Powerhouse": "Physical",
    "Cover": "Tactical", "Engine": "Tactical", "Destroyer": "Tactical",
    "Dribbler": "Technical", "Passer": "Technical", "Striker": "Technical",
    "GK": "Specialist",
}

# ATTR_ALIASES imported from lib.models


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

# Source priority: higher = preferred. When multiple sources provide the same
# attribute, the highest-priority source wins.
SOURCE_PRIORITY: dict[str, int] = {
    "scout_assessment": 50,
    "fbref":           40,
    "computed":        35,
    "understat":       30,
    "statsbomb":       25,
    "eafc_inferred":   10,
}

# Dampening factors per source. eafc_inferred inflates physical attributes
# (EA FC game data skews toward pace/acceleration), so we discount it.
SOURCE_WEIGHT: dict[str, float] = {
    "scout_assessment": 1.0,
    "fbref":           1.0,
    "computed":        0.95,
    "understat":       0.90,
    "statsbomb":       0.90,
    "eafc_inferred":   0.75,
}


# Sources considered reliable for personality inference.
# eafc_inferred fills mental attributes (leadership, communication, etc.)
# with synthetic mid-range values that don't reflect real personality.
PERSONALITY_TRUSTED_SOURCES = frozenset({
    "scout_assessment", "fbref", "computed", "understat", "statsbomb",
})


def normalize_grades(grades: list[dict]) -> tuple[dict[str, float], dict[str, float], bool, bool]:
    """
    Convert attribute_grades rows into {attribute: score_0_100}.

    Groups by attribute, picks the highest-priority source per attribute,
    and applies source-specific dampening weights.

    Returns (all_scores, personality_scores, has_any_scout_grade, has_differentiated_data).

    - all_scores: used for archetype scoring (includes eafc_inferred with dampening)
    - personality_scores: used for personality inference (excludes eafc_inferred)
    """
    has_scout = False
    stat_values: set[float] = set()

    # Key: attribute → list of (source, raw_value, is_scout_grade)
    attr_candidates: dict[str, list[tuple[str, float, bool]]] = {}

    # Detect scale per source
    source_max: dict[str, float] = {}
    for g in grades:
        src = g.get("source", "unknown")
        scout = g.get("scout_grade")
        stat = g.get("stat_score")
        val = scout if (scout is not None and scout > 0) else stat if (stat is not None and stat > 0) else None
        if val is not None:
            source_max[src] = max(source_max.get(src, 0), val)

    source_scale: dict[str, float] = {}
    for src, mx in source_max.items():
        source_scale[src] = 20.0 if mx > 10 else 10.0

    for g in grades:
        attr = g["attribute"]
        attr = ATTR_ALIASES.get(attr, attr)
        src = g.get("source", "unknown")
        scout = g.get("scout_grade")
        stat = g.get("stat_score")

        is_scout_grade = scout is not None and scout > 0
        raw = scout if is_scout_grade else stat if (stat is not None and stat > 0) else None
        if raw is None:
            continue

        if src == "scout_assessment":
            has_scout = True
        else:
            stat_values.add(stat)

        if attr not in attr_candidates:
            attr_candidates[attr] = []
        attr_candidates[attr].append((src, raw, is_scout_grade))

    # For each attribute, pick the highest-priority source and apply weight
    all_scores: dict[str, float] = {}
    personality_scores: dict[str, float] = {}

    for attr, candidates in attr_candidates.items():
        # Sort by source priority (highest first), then prefer scout_grade
        candidates.sort(key=lambda c: (-SOURCE_PRIORITY.get(c[0], 0), -int(c[2])))
        best_src, best_val, _ = candidates[0]

        scale = source_scale.get(best_src, 10.0)
        weight = SOURCE_WEIGHT.get(best_src, 0.8)
        all_scores[attr] = (best_val / scale) * 100.0 * weight

        # For personality: only include if best source is trusted
        if best_src in PERSONALITY_TRUSTED_SOURCES:
            personality_scores[attr] = (best_val / scale) * 100.0 * weight
        else:
            # Check if any trusted source exists for this attribute
            for src, raw, is_sc in candidates:
                if src in PERSONALITY_TRUSTED_SOURCES:
                    s = source_scale.get(src, 10.0)
                    w = SOURCE_WEIGHT.get(src, 0.8)
                    personality_scores[attr] = (raw / s) * 100.0 * w
                    break

    has_differentiated = has_scout or len(stat_values) > 1
    return all_scores, personality_scores, has_scout, has_differentiated


def score_models(attr_scores: dict[str, float], position: str | None) -> dict[str, float]:
    """Score all 13 SACROSANCT models. Returns {model: score_0_100}."""
    scores = {}
    pos = position or ""

    # Position-based affinity: small tiebreaker so contextually dominant
    # skill sets edge out ties (e.g. Striker beats Sprinter for a CF).
    # +0.3 is enough to break ties without overriding genuinely higher scores.
    _POS_AFFINITY: dict[str, list[str]] = {
        "CF": ["Striker", "Target"],
        "WF": ["Dribbler", "Striker", "Creator"],
        "AM": ["Creator", "Dribbler"],
        "CM": ["Controller", "Engine", "Passer"],
        "WM": ["Engine", "Dribbler", "Passer"],
        "DM": ["Cover", "Destroyer", "Controller"],
        "CD": ["Cover", "Destroyer", "Commander"],
        "WD": ["Engine", "Cover", "Sprinter"],
    }
    affinity_set = set(_POS_AFFINITY.get(pos, []))

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

        # Position affinity tiebreaker
        if model in affinity_set:
            raw += 0.3

        scores[model] = round(raw, 1)

    return scores


def best_model(scores: dict[str, float], threshold: float = 15.0) -> str | None:
    """
    Return compound archetype (Primary-Secondary) from top two model scores.

    The secondary skill set is included when:
      1. It scores above threshold, AND
      2. It reaches at least 70% of the primary score, AND
      3. It comes from a different compound category (diversity).

    This ensures most players get a two-skill-set "model" label that captures
    their dual strengths — e.g. "Creator-Dribbler", "Engine-Cover".
    """
    if not scores:
        return None
    ranked = sorted(scores.items(), key=lambda x: -x[1])
    if not ranked or ranked[0][1] < threshold:
        return None

    primary = ranked[0][0]
    primary_score = ranked[0][1]

    # Look for a strong secondary from a different category
    if len(ranked) > 1:
        primary_cat = MODEL_COMPOUNDS.get(primary)
        for secondary_name, secondary_score in ranked[1:]:
            secondary_cat = MODEL_COMPOUNDS.get(secondary_name)
            # Must be above threshold, reach 70% of primary, different category
            if (secondary_score >= threshold
                    and secondary_score >= primary_score * 0.70
                    and primary_cat != secondary_cat):
                return f"{primary}-{secondary_name}"
            # Stop searching once scores drop below threshold
            if secondary_score < threshold:
                break
    return primary


# ── Personality Inference ────────────────────────────────────────────────────
#
# Maps attribute_grades → personality dimension scores (0-100).
# Per SACROSANCT, the four dimensions are:
#   ei (Game Reading):      Analytical (A) ≥50 / Instinctive (I) <50
#   sn (Motivation):        Extrinsic  (X) ≥50 / Intrinsic   (N) <50
#   tf (Social Orientation): Soloist    (S) ≥50 / Leader      (L) <50
#   jp (Pressure Response):  Competitor (C) ≥50 / Composer    (P) <50
#
# Each dimension is computed as an average of relevant attribute proxies,
# some inverted (100 - score) to match the dimension polarity.

PERSONALITY_DIMENSIONS: dict[str, list[tuple[str, bool]]] = {
    # ei: high = Analytical (structured, pattern-reading)
    #     Analytical players: high anticipation, decisions, awareness, concentration
    "ei": [
        ("anticipation", False),
        ("decisions", False),
        ("awareness", False),
        ("concentration", False),
    ],
    # sn: high = Extrinsic (occasion-driven, crowd-fed)
    #     Extrinsic players: high intensity/aggression (feed off atmosphere)
    #     Intrinsic players: high discipline/drive (self-motivated)
    "sn": [
        ("intensity", False),
        ("aggression", False),
        ("discipline", True),   # inverted: high discipline → intrinsic
        ("drive", True),        # inverted: high drive → intrinsic
    ],
    # tf: high = Soloist (self-contained)
    #     Leader players: high leadership, communication
    #     Soloist players: low leadership, low communication
    "tf": [
        ("leadership", True),      # inverted: high leadership → Leader (low tf)
        ("communication", True),   # inverted: high communication → Leader (low tf)
        ("creativity", False),     # creative types tend to be soloists
        ("unpredictability", False),  # unpredictable players are self-focused
    ],
    # jp: high = Competitor (confrontational)
    #     Competitor: high aggression, duels
    #     Composer: high composure, discipline
    "jp": [
        ("aggression", False),
        ("duels", False),
        ("composure", True),     # inverted: high composure → Composer (low jp)
        ("discipline", True),    # inverted: high discipline → Composer (low jp)
    ],
}


def compute_biographical_signals(
    career: dict | None,
    news: dict | None,
) -> dict[str, float]:
    """
    Derive personality dimension signals from biographical data.
    Returns {dim: score_0_100} for dimensions with enough evidence.

    Sources (per SACROSANCT assessment methodology):
      - Career patterns: loyalty/mobility → sn (Motivation), leagues → ei (Game Reading)
      - News sentiment: controversy → jp (Pressure Response), transfer noise → tf (Social)
    """
    signals: dict[str, float] = {}

    if career:
        mobility = float(career.get("mobility_score") or 0)    # 1-20
        trajectory = career.get("trajectory") or ""
        leagues = int(career.get("leagues_count") or 0)

        # ── sn (Motivation): high mobility → Extrinsic (X), low → Intrinsic (N)
        if mobility > 0:
            career_sn = (mobility / 20.0) * 100.0
            if trajectory == "one-club":
                career_sn = max(0, career_sn - 15)
            elif trajectory == "journeyman":
                career_sn = min(100, career_sn + 15)
            signals["sn"] = max(0.0, min(100.0, career_sn))

        # ── ei (Game Reading): success across many leagues → more analytical
        if leagues >= 3:
            signals["ei"] = min(100.0, 50.0 + (leagues - 2) * 8.0)

    if news:
        story_types = news.get("story_types") or {}
        if isinstance(story_types, str):
            import json
            try:
                story_types = json.loads(story_types)
            except (json.JSONDecodeError, TypeError):
                story_types = {}
        sentiment = float(news.get("sentiment_score") or 10)   # 1-20
        total_stories = sum(story_types.values()) if story_types else 0

        if total_stories >= 3:
            # ── jp (Pressure Response): controversy → Competitor (C)
            controversy = story_types.get("controversy", 0)
            controversy_ratio = controversy / total_stories
            news_jp = 50.0 + (controversy_ratio * 80.0) - ((sentiment - 10.0) * 2.0)
            signals["jp"] = max(0.0, min(100.0, news_jp))

            # ── tf (Social Orientation): transfer-dominated news → Soloist
            transfer_ratio = story_types.get("transfer", 0) / total_stories
            news_tf = 50.0 + (transfer_ratio * 30.0)
            signals["tf"] = max(0.0, min(100.0, news_tf))

    return signals


def infer_personality(
    attr_scores: dict[str, float],
    bio_signals: dict[str, float] | None = None,
) -> dict[str, int] | None:
    """
    Infer personality dimension scores from attribute scores (0-100)
    blended with biographical signals from career/news data.

    When both sources exist for a dimension, blends at 65/35 (attr/bio).
    When only one source exists, uses it alone.
    Returns {ei, sn, tf, jp} as integers 0-100, or None if insufficient data.
    """
    ATTR_WEIGHT = 0.65
    BIO_WEIGHT = 0.35

    result: dict[str, int] = {}
    for dim, attrs in PERSONALITY_DIMENSIONS.items():
        values = []
        for attr_name, invert in attrs:
            v = attr_scores.get(attr_name)
            if v is not None:
                values.append((100.0 - v) if invert else v)

        attr_score = sum(values) / len(values) if len(values) >= 2 else None
        bio_score = (bio_signals or {}).get(dim)

        if attr_score is not None and bio_score is not None:
            blended = attr_score * ATTR_WEIGHT + bio_score * BIO_WEIGHT
        elif attr_score is not None:
            blended = attr_score
        elif bio_score is not None:
            blended = bio_score
        else:
            return None  # no data at all for this dimension

        result[dim] = max(0, min(100, round(blended)))
    return result


def infer_traits(
    attr_scores: dict[str, float],
    career: dict | None = None,
) -> dict[str, int | None]:
    """
    Infer competitiveness and coachability from attributes + career signals.
    Returns {competitiveness, coachability} as integers 1-10 (DB constraint).
    """
    # Competitiveness: aggression + duels + intensity + drive (0-100 → 1-10)
    comp_attrs = ["aggression", "duels", "intensity", "drive"]
    comp_vals = [attr_scores[a] for a in comp_attrs if a in attr_scores]
    if len(comp_vals) >= 2:
        competitiveness = max(1, min(10, round(sum(comp_vals) / len(comp_vals) / 10)))
    else:
        competitiveness = None

    # Coachability: discipline + concentration + awareness - aggression proxy (0-100 → 1-10)
    coach_attrs = [
        ("discipline", False),
        ("concentration", False),
        ("awareness", False),
        ("aggression", True),  # inverted: very aggressive players less coachable
    ]
    coach_vals = []
    for a, inv in coach_attrs:
        v = attr_scores.get(a)
        if v is not None:
            coach_vals.append((100.0 - v) if inv else v)
    if len(coach_vals) >= 2:
        coachability = max(1, min(10, round(sum(coach_vals) / len(coach_vals) / 10)))
    else:
        coachability = None

    # Career-based adjustments
    if career:
        trajectory = career.get("trajectory", "")
        mobility = float(career.get("mobility_score") or 0)

        # One-club players: committed to a system → more coachable
        if coachability is not None and trajectory == "one-club":
            coachability = min(10, coachability + 1)

        # High mobility: competitive ambition to seek bigger challenges
        if competitiveness is not None and mobility >= 14:
            competitiveness = min(10, competitiveness + 1)

    return {"competitiveness": competitiveness, "coachability": coachability}


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
    cur.execute("SELECT player_id, attribute, scout_grade, stat_score, source FROM attribute_grades")
    all_grades = cur.fetchall()
    grades_by_player: dict[int, list[dict]] = {}
    for g in all_grades:
        pid = g["player_id"]
        if pid not in grades_by_player:
            grades_by_player[pid] = []
        grades_by_player[pid].append(g)
    print(f"  {len(all_grades):,} grades for {len(grades_by_player):,} players.")

    # Load career metrics for personality signals (SACROSANCT inference source #6)
    print("Loading career metrics...")
    cur.execute("""
        SELECT person_id, loyalty_score, mobility_score, trajectory,
               clubs_count, loan_count, avg_tenure_yrs, max_tenure_yrs,
               leagues_count, career_years
        FROM career_metrics
    """)
    career_signals: dict[int, dict] = {row["person_id"]: row for row in cur.fetchall()}
    print(f"  {len(career_signals):,} career metric records.")

    # Load news sentiment for personality signals
    print("Loading news sentiment...")
    cur.execute("""
        SELECT person_id, sentiment_score, buzz_score,
               story_types, dominant_type
        FROM news_sentiment_agg
    """)
    news_signals: dict[int, dict] = {row["person_id"]: row for row in cur.fetchall()}
    print(f"  {len(news_signals):,} news sentiment records.")

    # Load existing personality data (to avoid overwriting manual assessments)
    print("Loading existing personality data...")
    cur.execute("SELECT person_id, is_inferred FROM player_personality")
    existing_personality: dict[int, bool] = {}
    for row in cur.fetchall():
        existing_personality[row["person_id"]] = row["is_inferred"]
    print(f"  {len(existing_personality):,} existing personality records ({sum(1 for v in existing_personality.values() if not v)} manual, {sum(1 for v in existing_personality.values() if v)} inferred)")

    # Build update plan
    arch_dist: dict[str, int] = {}
    method_dist: dict[str, int] = {"attribute_scored": 0, "undifferentiated": 0, "no_data": 0}
    mvt_changed = arch_changed = 0
    updates: list[tuple] = []
    personality_updates: list[tuple] = []  # (pid, ei, sn, tf, jp, comp, coach, sources)
    personality_new = personality_skip = 0

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
        attr_scores = None
        pers_scores = None  # personality-only scores (excludes eafc_inferred)

        if has_grades:
            attr_scores, pers_scores, has_scout, has_diff = normalize_grades(grades_by_player[pid])
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
                attr_scores = None
                pers_scores = None
        else:
            method_dist["no_data"] += 1

        # GK fallback: if position is GK and no archetype was scored, default to GK
        if not new_arch and position == "GK":
            new_arch = "GK"

        new_conf = archetype_confidence(has_grades, has_scout)

        # Preserve manually curated archetypes (profile_tier=1 = scout-assessed)
        if p.get("profile_tier") == 1 and cur_arch:
            new_arch = cur_arch
            new_conf = p.get("archetype_confidence") or new_conf

        label = new_arch or "(none)"
        arch_dist[label] = arch_dist.get(label, 0) + 1
        if new_arch != cur_arch:
            arch_changed += 1

        updates.append((pid, new_mvt, new_arch, new_conf))

        # ── Personality inference (multi-source: attributes + career + news)
        # Skip manual assessments (is_inferred=False means scout entered it)
        if pid in existing_personality and not existing_personality[pid]:
            personality_skip += 1
            continue

        career = career_signals.get(pid)
        news = news_signals.get(pid)

        if pers_scores or career or news:
            bio = compute_biographical_signals(career, news)
            dims = infer_personality(pers_scores or {}, bio_signals=bio or None)
            if dims:
                traits = infer_traits(pers_scores or {}, career=career)
                # Track which sources contributed
                sources = []
                if pers_scores:
                    sources.append("attribute_grades")
                if career:
                    sources.append("career_metrics")
                if news:
                    sources.append("news_sentiment")
                personality_updates.append((
                    pid,
                    dims["ei"], dims["sn"], dims["tf"], dims["jp"],
                    traits["competitiveness"], traits["coachability"],
                    ",".join(sources),
                ))
                personality_new += 1

    # ── Summary
    print(f"\nPlan:")
    print(f"  MVT updated for {mvt_changed:,} players")
    print(f"  Archetype changed for {arch_changed:,} players")
    print(f"  Personality inferred for {personality_new:,} players ({personality_skip:,} manual assessments preserved)")
    print(f"\nScoring method:")
    for method, count in sorted(method_dist.items(), key=lambda x: -x[1]):
        print(f"  {method:<20} {count:>6,}")
    print(f"\nArchetype distribution (SACROSANCT models):")
    max_n = max(arch_dist.values()) if arch_dist else 1
    for arch, n in sorted(arch_dist.items(), key=lambda x: -x[1]):
        bar = "█" * round(n / max_n * 30)
        pct = n / len(players) * 100
        print(f"  {arch:<14} {bar:<30} {n:>6,}  ({pct:.1f}%)")

    # Personality type distribution
    if personality_updates:
        ptype_dist: dict[str, int] = {}
        for _, ei, sn, tf, jp, _, _, _ in personality_updates:
            code = ("A" if ei >= 50 else "I") + ("X" if sn >= 50 else "N") + \
                   ("S" if tf >= 50 else "L") + ("C" if jp >= 50 else "P")
            ptype_dist[code] = ptype_dist.get(code, 0) + 1
        print(f"\nPersonality type distribution ({len(personality_updates):,} inferred):")
        max_p = max(ptype_dist.values()) if ptype_dist else 1
        for ptype, n in sorted(ptype_dist.items(), key=lambda x: -x[1]):
            bar = "█" * round(n / max_p * 30)
            pct = n / len(personality_updates) * 100
            print(f"  {ptype:<6} {bar:<30} {n:>6,}  ({pct:.1f}%)")

    # Source coverage summary
    if personality_updates:
        source_counts: dict[str, int] = {}
        for *_, sources_str in personality_updates:
            for src in sources_str.split(","):
                source_counts[src] = source_counts.get(src, 0) + 1
        print(f"\nPersonality inference sources:")
        for src, n in sorted(source_counts.items(), key=lambda x: -x[1]):
            pct = n / len(personality_updates) * 100
            print(f"  {src:<20} {n:>6,}  ({pct:.1f}%)")

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

    # ── Write personality (upsert into player_personality)
    if personality_updates:
        print(f"\nWriting {len(personality_updates):,} personality records...")
        cur.execute("""
            CREATE TEMP TABLE _personality_batch (
                pid INTEGER PRIMARY KEY,
                ei INTEGER,
                sn INTEGER,
                tf INTEGER,
                jp INTEGER,
                competitiveness INTEGER,
                coachability INTEGER,
                sources TEXT
            )
        """)
        for i in range(0, len(personality_updates), BATCH):
            batch = personality_updates[i:i + BATCH]
            cur.execute("TRUNCATE _personality_batch")
            execute_values(cur, """
                INSERT INTO _personality_batch (pid, ei, sn, tf, jp, competitiveness, coachability, sources)
                VALUES %s
            """, batch)
            cur.execute("""
                INSERT INTO player_personality (person_id, ei, sn, tf, jp, competitiveness, coachability, is_inferred, inference_notes)
                SELECT pid, ei, sn, tf, jp, competitiveness, coachability, true, sources
                FROM _personality_batch
                ON CONFLICT (person_id) DO UPDATE SET
                    ei = EXCLUDED.ei,
                    sn = EXCLUDED.sn,
                    tf = EXCLUDED.tf,
                    jp = EXCLUDED.jp,
                    competitiveness = EXCLUDED.competitiveness,
                    coachability = EXCLUDED.coachability,
                    is_inferred = true,
                    inference_notes = EXCLUDED.inference_notes,
                    updated_at = now()
                WHERE player_personality.is_inferred = true
            """)
            conn.commit()
            done = min(i + BATCH, len(personality_updates))
            print(f"  {done:,}/{len(personality_updates):,}", end="\r")
        print()

    print(f"Done. {len(updates):,} archetype + {len(personality_updates):,} personality rows committed.")
    conn.close()


if __name__ == "__main__":
    main()
