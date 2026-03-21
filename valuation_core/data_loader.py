"""
Data loader — reads player profiles from Supabase and constructs
PlayerProfile objects for the valuation engine.

Bridges the Chief Scout database schema to the valuation engine's
input types.
"""

from __future__ import annotations
from datetime import date as _date_type

from datetime import date
from typing import Optional

from valuation_core.config import (
    CONFIDENCE_WEIGHTS,
    LOW_OBSERVABILITY_ATTRIBUTES,
    MODEL_ATTRIBUTES,
    SOURCE_PRIORITY,
)
from valuation_core.types import (
    AttributeGrade,
    ClubContext,
    Confidence,
    DofAssessment,
    EvaluationContext,
    GradeType,
    PlayerProfile,
    SquadGap,
)


def load_player_profile(person_id: int, conn) -> Optional[PlayerProfile]:
    """
    Load a full PlayerProfile from Supabase/Postgres.

    Reads from: people, player_profiles, player_personality, player_market,
    player_status, attribute_grades, career_metrics.
    """
    cur = conn.cursor()

    # ── Core identity ─────────────────────────────────────────────────────────

    cur.execute("""
        SELECT p.id, p.name, p.date_of_birth, p.height_cm, p.preferred_foot,
               p.club_id, c.clubname as club_name,
               n.name as nation_name, p.contract_expiry_date
        FROM people p
        LEFT JOIN clubs c ON c.id = p.club_id
        LEFT JOIN nations n ON n.id = p.nation_id
        WHERE p.id = %s
    """, (person_id,))
    row = cur.fetchone()
    if not row:
        cur.close()
        return None

    cols = [d[0] for d in cur.description]
    person = dict(zip(cols, row))

    # Compute age
    age = None
    if person.get("date_of_birth"):
        dob = person["date_of_birth"]
        today = date.today()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

    # ── Profile data ──────────────────────────────────────────────────────────

    cur.execute("""
        SELECT position, level, archetype, profile_tier, best_role, best_role_score, xp_modifier, xp_level, legacy_score
        FROM player_profiles
        WHERE person_id = %s
    """, (person_id,))
    profile_row = cur.fetchone()
    profile_data = {}
    if profile_row:
        pcols = [d[0] for d in cur.description]
        profile_data = dict(zip(pcols, profile_row))

    # ── Personality ───────────────────────────────────────────────────────────

    cur.execute("""
        SELECT ei, sn, tf, jp, competitiveness, coachability
        FROM player_personality
        WHERE person_id = %s
    """, (person_id,))
    pers_row = cur.fetchone()
    personality_code = None
    if pers_row:
        pcols = [d[0] for d in cur.description]
        pers = dict(zip(pcols, pers_row))
        personality_code = _compute_personality_code(pers)

    # ── Market data ───────────────────────────────────────────────────────────

    cur.execute("""
        SELECT market_value_eur, transfer_fee_eur, director_valuation_meur
        FROM player_market
        WHERE person_id = %s
    """, (person_id,))
    market_row = cur.fetchone()
    market_data = {}
    if market_row:
        mcols = [d[0] for d in cur.description]
        market_data = dict(zip(mcols, market_row))

    # ── Status data ───────────────────────────────────────────────────────────

    cur.execute("""
        SELECT contract_tag, pursuit_status, scouting_notes
        FROM player_status
        WHERE person_id = %s
    """, (person_id,))
    status_row = cur.fetchone()
    status_data = {}
    if status_row:
        scols = [d[0] for d in cur.description]
        status_data = dict(zip(scols, status_row))

    # ── Attribute grades ──────────────────────────────────────────────────────

    cur.execute("""
        SELECT attribute, scout_grade, stat_score, source, is_inferred, updated_at
        FROM attribute_grades
        WHERE player_id = %s
    """, (person_id,))
    grade_rows = cur.fetchall()
    gcols = [d[0] for d in cur.description]
    grades_raw = [dict(zip(gcols, r)) for r in grade_rows]

    # Process into AttributeGrade objects and archetype scores
    attributes, archetype_scores = _process_grades(grades_raw)

    # ── Career metrics ────────────────────────────────────────────────────────

    cur.execute("""
        SELECT trajectory
        FROM career_metrics
        WHERE person_id = %s
    """, (person_id,))
    career_row = cur.fetchone()
    trajectory = career_row[0] if career_row else None

    # ── Contract years estimation ─────────────────────────────────────────────
    # Prefer contract_expiry_date (from people table) over contract_tag
    contract_years = None
    expiry = person.get("contract_expiry_date")
    if expiry:
        if isinstance(expiry, str):
            try:
                expiry = _date_type.fromisoformat(expiry)
            except ValueError:
                expiry = None
        if expiry:
            delta = (expiry - _date_type.today()).days / 365.25
            contract_years = max(0.0, round(delta, 1))

    if contract_years is None:
        contract_years = _estimate_contract_years(status_data.get("contract_tag"))

    # ── Tags (from player_tags) ───────────────────────────────────────────────

    cur.execute("""
        SELECT t.tag_name
        FROM player_tags pt
        JOIN tags t ON t.id = pt.tag_id
        WHERE pt.player_id = %s
    """, (person_id,))
    tag_rows = cur.fetchall()
    all_tags = [r[0] for r in tag_rows]

    # Separate personality tags from style tags
    from valuation_core.config import RISK_TAGS, VALUE_TAGS
    from valuation_core.features.profile_features import ALL_STYLE_TAGS

    personality_tags = [t for t in all_tags if t in RISK_TAGS or t in VALUE_TAGS]
    style_tags = [t for t in all_tags if t in ALL_STYLE_TAGS]

    # ── Get league from club ──────────────────────────────────────────────────

    league = None
    if person.get("club_id"):
        cur.execute("SELECT league_name FROM clubs WHERE id = %s", (person["club_id"],))
        league_row = cur.fetchone()
        if league_row:
            league = league_row[0]

    cur.close()

    return PlayerProfile(
        person_id=person_id,
        name=person["name"],
        age=age,
        position=profile_data.get("position"),
        height_cm=person.get("height_cm"),
        preferred_foot=person.get("preferred_foot"),
        archetype_scores=archetype_scores,
        attributes=attributes,
        personality_code=personality_code,
        personality_tags=personality_tags,
        playing_style_tags=style_tags,
        contract_years_remaining=contract_years,
        contract_tag=status_data.get("contract_tag"),
        transfer_fee_eur=market_data.get("transfer_fee_eur"),
        market_value_eur=market_data.get("market_value_eur"),
        league=league,
        club=person.get("club_name"),
        club_id=person.get("club_id"),
        trajectory=trajectory,
        level=profile_data.get("level"),
        best_role_score=profile_data.get("best_role_score"),
        best_role=profile_data.get("best_role"),
        profile_tier=profile_data.get("profile_tier"),
        xp_modifier=profile_data.get("xp_modifier"),
        xp_level=profile_data.get("xp_level"),
        legacy_score=profile_data.get("legacy_score"),
    )


def _compute_personality_code(pers: dict) -> str | None:
    """Convert personality dimension scores to 4-letter code."""
    if not any(pers.get(k) is not None for k in ("ei", "sn", "tf", "jp")):
        return None

    code = ""
    # Game Reading: A (≥50) / I (<50)
    ei = pers.get("ei")
    code += "A" if (ei is not None and ei >= 50) else "I"

    # Motivation: X (≥50) / N (<50)
    sn = pers.get("sn")
    code += "X" if (sn is not None and sn >= 50) else "N"

    # Social: S (≥50) / L (<50)
    tf = pers.get("tf")
    code += "S" if (tf is not None and tf >= 50) else "L"

    # Pressure: C (≥50) / P (<50)
    jp = pers.get("jp")
    code += "C" if (jp is not None and jp >= 50) else "P"

    return code


def _process_grades(
    grades_raw: list[dict],
) -> tuple[dict[str, AttributeGrade], dict[str, float]]:
    """
    Process raw grade rows into AttributeGrade objects and archetype scores.

    Applies source priority: scout > fbref > statsbomb > understat > computed > eafc.
    """
    # Group by attribute, pick best source
    best_by_attr: dict[str, dict] = {}
    for g in grades_raw:
        attr = g["attribute"].lower().replace(" ", "_")
        source = g.get("source", "")
        priority = SOURCE_PRIORITY.get(source, 0)

        existing = best_by_attr.get(attr)
        if existing is None or priority > existing.get("_priority", 0):
            best_by_attr[attr] = {**g, "_priority": priority, "_attr_key": attr}

    # Convert to AttributeGrade objects
    attributes: dict[str, AttributeGrade] = {}
    for attr_key, g in best_by_attr.items():
        # Effective grade: scout_grade (0-20) or stat_score (0-20), normalize to 0-10
        scout = g.get("scout_grade")
        stat = g.get("stat_score")
        source = g.get("source", "")

        if scout is not None and scout > 0:
            effective = min(scout / 2, 10.0)  # 0-20 → 0-10
            grade_type = GradeType.SCOUT
        elif stat is not None and stat > 0:
            effective = min(stat / 2, 10.0)
            grade_type = GradeType.STAT
        else:
            effective = 5.0  # default midpoint
            grade_type = GradeType.INFERRED

        # Is it inferred?
        if g.get("is_inferred") or source == "eafc_inferred":
            grade_type = GradeType.INFERRED

        # Confidence
        confidence = _determine_confidence(source, grade_type, attr_key)

        # Staleness (older than 18 months — simplified check)
        stale = False  # would check updated_at in production

        attributes[attr_key] = AttributeGrade(
            effective_grade=effective,
            grade_type=grade_type,
            confidence=confidence,
            stale=stale,
        )

    # Compute archetype scores from attributes
    # Require at least 2 of 4 attributes populated to score a model —
    # prevents a single stray grade (e.g. reactions on a CF) inflating irrelevant models
    archetype_scores: dict[str, float] = {}
    for model, model_attrs in MODEL_ATTRIBUTES.items():
        values = []
        for attr in model_attrs:
            grade = attributes.get(attr)
            if grade:
                values.append(grade.effective_grade)
        if len(values) >= 2:
            # Mean of attributes × 10 → 0-100 scale
            archetype_scores[model] = min(round(sum(values) / len(values) * 10, 1), 100)

    return attributes, archetype_scores


def _determine_confidence(
    source: str, grade_type: GradeType, attr_key: str,
) -> Confidence:
    """Determine confidence level based on source and attribute observability."""
    if grade_type == GradeType.INFERRED:
        return Confidence.LOW

    if source == "scout_assessment":
        return Confidence.HIGH

    # Low-observability attributes capped at Medium from stats
    if attr_key in LOW_OBSERVABILITY_ATTRIBUTES:
        return Confidence.MEDIUM

    if source in ("fbref", "statsbomb"):
        return Confidence.MEDIUM

    return Confidence.LOW


def load_dof_assessment(person_id: int, conn) -> DofAssessment | None:
    """Load the current DoF assessment for a player, if one exists."""
    cur = conn.cursor()
    cur.execute("""
        SELECT person_id, technical, physical, tactical, personality,
               commercial, availability,
               worth_right_team_meur, worth_any_team_meur,
               confidence, usage_profile, summary
        FROM dof_assessments
        WHERE person_id = %s AND is_current = true
    """, (person_id,))
    row = cur.fetchone()

    if not row:
        cur.close()
        return None

    cols = [d[0] for d in cur.description]
    d = dict(zip(cols, row))
    cur.close()

    return DofAssessment(
        person_id=d["person_id"],
        technical=d["technical"] or 5,
        physical=d["physical"] or 5,
        tactical=d["tactical"] or 5,
        personality=d["personality"] or 5,
        commercial=d["commercial"] or 5,
        availability=d["availability"] or 5,
        worth_right_team_meur=float(d["worth_right_team_meur"] or 0),
        worth_any_team_meur=float(d["worth_any_team_meur"] or 0),
        confidence=d["confidence"] or "informed",
        usage_profile=d.get("usage_profile"),
        summary=d.get("summary"),
    )


def _estimate_contract_years(contract_tag: str | None) -> float:
    """Estimate contract years remaining from contract tag."""
    mapping = {
        "Long-Term": 4.0,
        "Extension Talks": 3.0,
        "One Year Left": 1.0,
        "Six Months": 0.5,
        "Expired": 0.0,
    }
    if not contract_tag:
        return 3.0  # Unknown contract → assume mid-range (neutral)
    return mapping.get(contract_tag, 2.0)
