"""
27_player_ratings.py — Compute composite player ratings from multi-source data.

Combines:
  - attribute_grades (fbref, statsbomb, understat, eafc_inferred, scout_assessment)
  - 13 playing models → 4 compound scores (Technical, Tactical, Physical, Mental)
  - career_metrics (trajectory, loyalty)
  - news_sentiment_agg (buzz, sentiment)
  - player_profiles (existing level, peak)

Outputs:
  - Updates player_profiles.overall with computed technical rating
  - Writes per-model scores to attribute_grades with source='computed'

Usage:
    python 27_player_ratings.py                    # all players with attribute data
    python 27_player_ratings.py --player 123       # single player
    python 27_player_ratings.py --limit 100        # first 100 players
    python 27_player_ratings.py --dry-run           # preview without writing
    python 27_player_ratings.py --force             # overwrite existing ratings
"""
import argparse
import math
import sys
from datetime import datetime, timezone

from config import POSTGRES_DSN
from lib.db import require_conn, get_supabase
from lib.models import MODEL_ATTRIBUTES as _BASE_MODEL_ATTRIBUTES, SOURCE_PRIORITY, ATTR_ALIASES as _BASE_ATTR_ALIASES

# ── Argument parsing ───────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Compute composite player ratings")
parser.add_argument("--player", type=str, default=None,
                    help="Single person_id to process")
parser.add_argument("--limit", type=int, default=None,
                    help="Max players to process")
parser.add_argument("--dry-run", action="store_true",
                    help="Print summaries without writing to database")
parser.add_argument("--force", action="store_true",
                    help="Overwrite existing ratings")
parser.add_argument("--incremental", action="store_true",
                    help="Only process players with data changes since last run")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
CHUNK_SIZE = 200

# ── Connections ────────────────────────────────────────────────────────────────

conn = require_conn(autocommit=True)
sb_client = get_supabase()


# ── Model Definitions ─────────────────────────────────────────────────────────
# Base MODEL_ATTRIBUTES imported from lib.models.
# Override GK model for ratings: uses positional/distribution attributes
# rather than the standard reflex-based GK model used by radar/fingerprints.
MODEL_ATTRIBUTES = {
    **_BASE_MODEL_ATTRIBUTES,
    "GK": ["positioning", "awareness", "pass_range", "throwing"],
}

# Fallback aliases: when the primary attribute is missing, try these instead.
# Only used if the primary has zero data. Keeps models functional with sparse data.
# IMPORTANT: aliases must not map to another attribute already in the same model,
# or the model will double-count. Each alias should be a distinct proxy.
# Extends the base ATTR_ALIASES from lib.models with ratings-specific proxies.
ATTRIBUTE_ALIASES = {
    **_BASE_ATTR_ALIASES,
    "unpredictability": "take_ons",     # flair proxy (skills is in Dribbler, avoid double-count)
    "guile":            "through_balls", # cunning ≈ incisive passing
    "decisions":        "positioning",  # decision-making ≈ reading the game
    "communication":    "leadership",   # vocal ≈ captain material
    "concentration":    "discipline",   # focus ≈ discipline (not awareness — already in Cover)
    "drive":            "intensity",    # motivation ≈ work rate
    "versatility":      "stamina",      # engine coverage ≈ fitness
    "blocking":         "tackling",     # defensive action proxy
    "clearances":       "heading",      # aerial clearances ≈ heading
    "duels":            "aggression",   # physical contests ≈ aggression
    "marking":          "interceptions",# defensive reading ≈ interceptions (not tackling — already Destroyer)
    "positioning":      "awareness",    # positional sense ≈ spatial awareness
}

# 4 compound groupings
COMPOUND_MODELS = {
    "Technical": ["Dribbler", "Passer", "Striker", "GK"],
    "Tactical":  ["Cover", "Destroyer", "Engine"],
    "Physical":  ["Sprinter", "Powerhouse", "Target"],
    "Mental":    ["Controller", "Commander", "Creator"],
}

# GK-specific compounds: only models that matter for goalkeepers.
# Outfield models (Dribbler, Striker, Sprinter, etc.) are noise for GKs.
GK_COMPOUND_MODELS = {
    "Technical": ["GK", "Passer"],          # Shot-stopping + distribution
    "Tactical":  ["Cover", "Commander"],     # Positioning + organisation
    "Physical":  ["Sprinter", "Target"],     # Agility + aerial presence
    "Mental":    ["Controller", "Commander"],  # Decision-making + leadership
}

# Position weights for role fit (mirrors radar route.ts)
# Position weights for role fit.
# Tight range (0.8-1.0) so the DATA decides the role, not the weights.
# With a wide range, the highest-weighted model always wins regardless of
# the player's actual profile. A tight range means a player with genuinely
# strong Engine data CAN beat a player with strong Dribbler data.
POSITION_WEIGHTS = {
    "GK":  {"GK": 1.0, "Passer": 0.9, "Cover": 0.9, "Commander": 0.9, "Powerhouse": 0.9, "Controller": 0.8},
    "CD":  {"Destroyer": 1.0, "Cover": 0.95, "Commander": 0.9, "Passer": 0.85, "Target": 0.85, "Powerhouse": 0.85, "Controller": 0.8},
    "WD":  {"Engine": 1.0, "Dribbler": 0.95, "Passer": 0.95, "Sprinter": 0.9, "Cover": 0.85, "Controller": 0.85, "Destroyer": 0.8},
    "DM":  {"Cover": 1.0, "Destroyer": 0.95, "Controller": 0.90, "Passer": 0.90, "Commander": 0.85, "Powerhouse": 0.85},
    "CM":  {"Engine": 1.0, "Passer": 0.90, "Cover": 0.85, "Sprinter": 0.85, "Controller": 0.80, "Creator": 0.80},
    "WM":  {"Dribbler": 1.0, "Engine": 0.95, "Passer": 0.95, "Sprinter": 0.9, "Creator": 0.85, "Controller": 0.85, "Cover": 0.8},
    "AM":  {"Creator": 1.0, "Dribbler": 0.95, "Controller": 0.95, "Engine": 0.9, "Passer": 0.9, "Striker": 0.85, "Sprinter": 0.85},
    "WF":  {"Dribbler": 1.0, "Sprinter": 0.95, "Striker": 0.9, "Creator": 0.9, "Engine": 0.85},
    "CF":  {"Striker": 1.0, "Sprinter": 0.95, "Target": 0.9, "Creator": 0.9, "Engine": 0.9, "Powerhouse": 0.85, "Dribbler": 0.85, "Controller": 0.8, "Destroyer": 0.8},
}

# Tactical roles — loaded from DB (valid_position_roles view).
# Roles are validated bottom-up: only roles that appear in real tactical
# systems (slot_roles → system_slots) are valid candidates.
# Fallback: hardcoded dict for offline/test use if DB view unavailable.

def _load_tactical_roles(cursor):
    """Load valid roles per position from the systems hierarchy.

    Returns dict: position → [(primary_model, secondary_model, role_name), ...]
    """
    try:
        cursor.execute("""
            SELECT position, role_name, primary_model, secondary_model
            FROM valid_position_roles
            ORDER BY position, role_name
        """)
        roles = {}
        for pos, name, primary, secondary in cursor.fetchall():
            roles.setdefault(pos, []).append((primary, secondary, name))
        if roles:
            return roles
    except Exception as e:
        print(f"  WARNING: Could not load roles from DB ({e}), using fallback")

    # Fallback: 40-role set from the Systems & Roles redesign (2026-03-30)
    return {
        "GK": [
            ("GK", "Commander",    "Comandante"),
            ("GK", "Cover",        "Sweeper Keeper"),
            ("GK", "Passer",       "Distributor"),
            ("GK", "Powerhouse",   "Shotstopper"),
        ],
        "CD": [
            ("Commander", "Destroyer", "Centrale"),
            ("Passer",    "Cover",     "Distributor"),
            ("Powerhouse","Destroyer", "Stopper"),
            ("Cover",     "Controller","Sweeper"),
        ],
        "WD": [
            ("Engine",     "Passer",    "Fullback"),
            ("Engine",     "Dribbler",  "Wing-back"),
            ("Cover",      "Destroyer", "Corner Back"),
            ("Controller", "Passer",    "Invertido"),
        ],
        "DM": [
            ("Passer",     "Controller","Regista"),
            ("Controller", "Cover",     "Pivote"),
            ("Cover",      "Engine",    "Anchor"),
            ("Destroyer",  "Engine",    "Ballwinner"),
            ("Powerhouse", "Engine",    "Segundo Volante"),
        ],
        "CM": [
            ("Creator",    "Passer",    "Playmaker"),
            ("Controller", "Passer",    "Metodista"),
            ("Engine",     "Creator",   "Mezzala"),
            ("Engine",     "Cover",     "Tuttocampista"),
            ("Engine",     "Destroyer", "Ballwinner"),
        ],
        "WM": [
            ("Sprinter",   "Dribbler",  "Winger"),
            ("Engine",     "Cover",     "Tornante"),
            ("Controller", "Creator",   "False Winger"),
            ("Creator",    "Passer",    "Wide Playmaker"),
        ],
        "AM": [
            ("Dribbler",   "Creator",   "Trequartista"),
            ("Creator",    "Controller","Enganche"),
            ("Engine",     "Striker",   "Incursore"),
            ("Controller", "Creator",   "Mediapunta"),
        ],
        "WF": [
            ("Dribbler",   "Striker",   "Inside Forward"),
            ("Sprinter",   "Dribbler",  "Winger"),
            ("Creator",    "Passer",    "Wide Playmaker"),
            ("Target",     "Powerhouse","Wide Target Forward"),
        ],
        "CF": [
            ("Striker",    "Target",    "Prima Punta"),
            ("Striker",    "Creator",   "Complete Forward"),
            ("Creator",    "Controller","Falso Nove"),
            ("Engine",     "Destroyer", "Spearhead"),
            ("Target",     "Powerhouse","Target Forward"),
            ("Creator",    "Striker",   "Seconda Punta"),
            ("Sprinter",   "Striker",   "Shadow Striker"),
        ],
    }


TACTICAL_ROLES = _load_tactical_roles(conn.cursor())

# Position weights for overall calculation (which compounds matter per position)
POSITION_COMPOUND_WEIGHTS = {
    "GK":  {"Technical": 0.5, "Tactical": 0.2, "Physical": 0.1, "Mental": 0.2},
    "CD":  {"Technical": 0.1, "Tactical": 0.4, "Physical": 0.3, "Mental": 0.2},
    "WD":  {"Technical": 0.2, "Tactical": 0.3, "Physical": 0.3, "Mental": 0.2},
    "DM":  {"Technical": 0.2, "Tactical": 0.4, "Physical": 0.2, "Mental": 0.2},
    "CM":  {"Technical": 0.3, "Tactical": 0.2, "Physical": 0.2, "Mental": 0.3},
    "WM":  {"Technical": 0.3, "Tactical": 0.2, "Physical": 0.3, "Mental": 0.2},
    "AM":  {"Technical": 0.4, "Tactical": 0.1, "Physical": 0.2, "Mental": 0.3},
    "WF":  {"Technical": 0.3, "Tactical": 0.1, "Physical": 0.3, "Mental": 0.3},
    "CF":  {"Technical": 0.3, "Tactical": 0.1, "Physical": 0.3, "Mental": 0.3},
}

# SOURCE_PRIORITY imported from lib.models


# ── Helpers ────────────────────────────────────────────────────────────────────

def _safe(val):
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    return val


def compute_model_scores(grades, level=None, position=None, league_strength=None):
    """Compute model scores (0-100) from best-source attribute grades.

    scout_grade uses a 1-20 scale; stat_score uses a 1-10 scale.
    Both are normalised to 0-20 before averaging.

    league_strength: optional float (0.40-1.15) applied to stat sources that
    aren't already pre-scaled. Scout grades and API-Football (pre-scaled in
    pipeline 66) are NOT adjusted.

    Returns (anchored_scores, raw_scores):
      - anchored_scores: blended with level when data is thin — used for
        compound/overall calculations where we want to avoid penalising
        players with incomplete data.
      - raw_scores: pure data-driven scores — used for role selection where
        inflated thin-data models would distort role fit.
    """
    # Build best-grade-per-attribute map (prefer highest-priority source)
    best = {}  # attr -> (normalised_score_0_20, priority)
    # Check if this player has any non-EAFC/proxy grades. If not, allow EAFC
    # as fallback — better than no data at all (critical for thin OTP nations).
    has_real_grades = any(
        g.get("source", "") not in ("eafc_inferred", "proxy_inferred")
        for g in grades
    )
    for g in grades:
        source = g.get("source", "")
        # EAFC ratings are video game numbers, not scouting data.
        # Proxy grades are derived from other attrs for personality inference
        # only — they inflate model scores (esp. Commander for CDs).
        # Both stay in DB for reference but don't feed role scoring
        # UNLESS the player has no real data at all (thin nation fallback).
        if source == "proxy_inferred":
            continue
        if source == "eafc_inferred" and has_real_grades:
            continue
        attr = g["attribute"].lower().replace(" ", "_")
        # Normalise to 0-20 scale regardless of source.
        # Only scout_assessment can reach 19-20; all stat sources cap at 18.
        # This reserves the top of the scale for human assessment.
        if g["scout_grade"] is not None and g["scout_grade"] > 0:
            if source == "llm_inferred":
                # LLM grades cluster 12-16 (too generous for average players,
                # reasonable for elite). Compress to match stat source ceiling:
                #   LLM 18→16, 16→15, 14→13.5, 12→12, 10→10.5
                # Cap at 16 (same as stat sources) so LLM never exceeds
                # the stat ceiling. Only real scout assessment reaches 17+.
                score_20 = min(g["scout_grade"] * 0.85 + 2, 16)
            else:
                score_20 = min(g["scout_grade"], 20)  # clamp to 1-20; only scouts hit 19-20
        elif g.get("stat_score") is not None and g["stat_score"] > 0:
            ss = g["stat_score"]
            if source == "understat":
                # Understat clusters high (9-10 for any decent player).
                # Compress: 10→17, 8→14, 5→9. Prevents understat-only
                # players from scoring as if they had elite scout grades.
                score_20 = min(ss * 1.7, 17)
            else:
                # StatsBomb, API-Football, computed, fbref: 1-10 scale.
                # Linear ×2 up to 7 (preserves low/mid range), then
                # diminishing returns above 7 so top decile doesn't
                # all compress to the same ceiling.
                #   stat 5→10, 7→14, 8→14.7, 9→15.3, 10→16
                # Cap at 16: scores 17+ reserved for scout assessment.
                # Previously ×2 cap 18 — meant 1,500 players all scored
                # 18/20 on Striker attrs, making Prima Punta OP.
                if ss <= 7:
                    score_20 = ss * 2.0
                else:
                    score_20 = 14.0 + (ss - 7) * 0.67
                score_20 = min(score_20, 16)
        else:
            continue
        # League strength scaling: discount stat grades from weaker leagues.
        # Scout grades reflect context-aware human assessment — no scaling.
        # API-Football grades are already pre-scaled in pipeline 66.
        # Computed grades are derived — no scaling.
        PRESCALED_SOURCES = {"scout_assessment", "computed", "api_football"}
        if source not in PRESCALED_SOURCES and league_strength is not None:
            score_20 = score_20 * league_strength
        priority = SOURCE_PRIORITY.get(source, 0)
        existing = best.get(attr)
        if existing is None or priority > existing[1]:
            best[attr] = (score_20, priority)

    # Level-derived anchor: what a player of this level "should" score
    # Conservative: level itself, not inflated. A level 85 player anchors at 85.
    level_anchor = min(level, 95) if level else None

    # Compute each model score — both raw and anchored variants
    #
    # Coverage confidence: with fewer attributes, we're less certain of the
    # model score. Light penalty for 3/4 (trustworthy), moderate for 2/4,
    # heavy for 1/4 (single data point).
    #
    # Confidence map: 4/4 → 1.0, 3/4 → 0.95, 2/4 → 0.85, 1/4 → 0.70
    COVERAGE_CONFIDENCE = {4: 1.0, 3: 0.95, 2: 0.85, 1: 0.70}

    anchored_scores = {}
    raw_scores = {}
    for model, attrs in MODEL_ATTRIBUTES.items():
        # Try each attribute, falling back to alias if primary is missing.
        # Aliases are proxies — discount them (0.7× weight) to prevent
        # cross-model inflation (e.g. take_ons inflating both Dribbler and Creator).
        values = []
        alias_count = 0
        used_attrs = set()
        for a in attrs:
            if a in best:
                values.append(best[a][0])
                used_attrs.add(a)
            else:
                alias = ATTRIBUTE_ALIASES.get(a)
                if alias and alias in best and alias not in used_attrs:
                    values.append(best[alias][0] * 0.7)  # discount proxy
                    used_attrs.add(alias)
                    alias_count += 1
        if values:
            avg = sum(values) / len(values)
            # Curved conversion: linear up to 12/20 (=60), then accelerating.
            # Scout grades practically cap at 16/20 — linear *5 maps that to
            # only 80/100, compressing elite players. The curve stretches the
            # 12-20 range so 16→84, 17→88, 18→92.
            if avg <= 12:
                full_score = min(avg * 5, 99)
            else:
                excess = avg - 12
                full_score = min(60 + (excess / 8) ** 0.7 * 39, 99)

            # Coverage: aliases count as half for confidence purposes
            effective_coverage = len(values) - alias_count * 0.5
            confidence = COVERAGE_CONFIDENCE.get(len(values), 0.70)
            if alias_count > 0:
                # Blend toward lower confidence when aliases pad the count
                real_conf = COVERAGE_CONFIDENCE.get(len(values) - alias_count, 0.70)
                confidence = (confidence + real_conf) / 2
            raw_score = full_score * confidence
            raw_scores[model] = round(raw_score)

            # Anchored version: blend with level when data is thin (<3 of 4 attrs)
            anchored = raw_score
            if level_anchor and len(values) < 3:
                data_weight = len(values) / len(attrs)
                anchored = raw_score * data_weight + level_anchor * (1 - data_weight)
            anchored_scores[model] = round(anchored)

    # Proxy inference: fill missing model scores from available attributes.
    # Many roles require Sprinter/Engine/Controller/Target models that lack
    # direct data coverage. Proxy scores are discounted (0.75×) so they
    # never outcompete real data-driven scores.
    from lib.proxy_models import infer_proxy_scores
    proxy = infer_proxy_scores(best, raw_scores)
    for model_name, proxy_score in proxy.items():
        raw_scores[model_name] = proxy_score
        # Anchored = proxy (no level blend needed — proxy is already conservative)
        anchored_scores[model_name] = proxy_score

    return anchored_scores, raw_scores


def compute_compound_scores(model_scores, position=None):
    """Compute compound scores from model scores.

    GKs use GK-specific compound groupings that exclude irrelevant
    outfield models (Striker, Dribbler, etc.) which add noise.
    """
    compound_map = GK_COMPOUND_MODELS if position == "GK" else COMPOUND_MODELS
    compounds = {}
    for compound, models in compound_map.items():
        values = [model_scores[m] for m in models if m in model_scores]
        if values:
            compounds[compound] = round(sum(values) / len(values))
    return compounds


def compute_overall(compound_scores, position, level=None, peak=None, grade_count=0):
    """
    Compute overall rating as a position-weighted compound average.

    The technical weight scales with data coverage:
    - Rich data (40+ grades): 50% technical, 50% level
    - Thin data (10 grades):  20% technical, 80% level
    - Zero grades:            skipped (shouldn't reach here)

    Peak is not used — level is the sole editorial anchor.
    If level unavailable, 100% from compound scores.
    """
    weights = POSITION_COMPOUND_WEIGHTS.get(position, {
        "Technical": 0.25, "Tactical": 0.25, "Physical": 0.25, "Mental": 0.25,
    })

    weighted_sum = 0
    total_weight = 0
    for compound, weight in weights.items():
        if compound in compound_scores:
            weighted_sum += compound_scores[compound] * weight
            total_weight += weight

    if total_weight <= 0:
        return None

    technical_overall = weighted_sum / total_weight

    # Scale tech weight by data coverage: more grades → trust data more
    # 50+ grades → tech_pct=0.65, 20 grades → 0.40, 8 grades → 0.30
    # Minimum 0.30 prevents level from dominating thin profiles.
    # Maximum 0.65 ensures data-rich players are primarily data-driven.
    if level is not None:
        tech_pct = min(0.65, max(0.30, grade_count / 80))
        editorial_pct = 1.0 - tech_pct
        overall = technical_overall * tech_pct + level * editorial_pct
    else:
        overall = technical_overall

    return round(min(max(overall, 1), 99))


def compute_best_role(model_scores, position, grade_count=0):
    """Compute the best tactical role and its score for a player.

    Returns (role_name, role_score) where role_score is 0-100.
    When a required model has no data, we skip that role entirely rather
    than letting a zero drag the score down.

    Model scores are weighted by POSITION_WEIGHTS so that position-relevant
    models contribute more to role fit (e.g. Destroyer matters more for CD
    than Passer does).

    Thin-data damper: players with <25 real grades get their role score
    compressed toward 70 to prevent thin stat profiles from producing
    inflated scores (e.g. backup strikers with 15 API Football grades
    all at the top decile).
    """
    roles = TACTICAL_ROLES.get(position, [])
    if not roles:
        return None, 0

    pos_weights = POSITION_WEIGHTS.get(position, {})

    best_role = None
    best_score = -1
    best_max_score = 1
    for primary, secondary, name in roles:
        p_raw = model_scores.get(primary)
        s_raw = model_scores.get(secondary)
        # Skip roles where the primary model has no data at all
        if p_raw is None:
            continue
        p_weight = pos_weights.get(primary, 0.2)
        s_weight = pos_weights.get(secondary, 0.2)
        if s_raw is None:
            score = p_raw * p_weight * 0.85
            max_possible = 99 * p_weight * 0.85
        else:
            score = p_raw * p_weight * 0.6 + s_raw * s_weight * 0.4
            max_possible = 99 * p_weight * 0.6 + 99 * s_weight * 0.4
        if score > best_score:
            best_score = score
            best_role = name
            best_max_score = max_possible

    if best_role is None:
        return None, 0
    # Normalize to 0-99: a player with all-99 model scores gets role score 99
    normalised = (best_score / best_max_score) * 99 if best_max_score > 0 else best_score

    # Top-end stretch: scout grades practically cap at 16/20, compressing
    # elite players into the 80-89 band. Power curve above 70 stretches
    # the top end so elite players get proper separation.
    # 70→70, 75→81, 80→86, 85→90, 87→92, 89→93
    if normalised > 70:
        excess = normalised - 70
        max_excess = 29  # 99 - 70
        stretched = (excess / max_excess) ** 0.55 * max_excess
        normalised = 70 + stretched

    # Thin-data damper: compress toward 70 when data is sparse.
    # 40+ grades → no damping, 20 grades → 25% pull toward 70,
    # 10 grades → 50% pull. Prevents backup strikers with 15 high-decile
    # API Football grades from scoring 89.
    if grade_count < 40 and normalised > 70:
        confidence = min(1.0, grade_count / 40)
        normalised = 70 + (normalised - 70) * confidence

    return best_role, round(min(max(normalised, 0), 99))


def has_differentiated_data(model_scores):
    """Check if data has real variation (not all flat eafc defaults)."""
    values = list(model_scores.values())
    if len(values) < 2:
        return False
    return len(set(values)) > 1


def _compute_base_gk_score(grades):
    """Compute a GK model score using the BASE attributes (agility, footwork,
    handling, reactions) rather than the overridden ones.  Used for role
    selection so GKs whose data comes from eafc_inferred (which provides the
    base attrs, not positioning/awareness/pass_range/throwing) still get a
    valid GK model score for role assignment.

    Returns the score (0-99) or None if no matching attributes found.
    """
    base_gk_attrs = _BASE_MODEL_ATTRIBUTES["GK"]  # agility, footwork, handling, reactions

    # Build best-grade-per-attribute map (same logic as compute_model_scores)
    best = {}
    for g in grades:
        source = g.get("source", "")
        if source == "eafc_inferred":
            continue
        attr = g["attribute"].lower().replace(" ", "_")
        if g["scout_grade"] is not None and g["scout_grade"] > 0:
            score_20 = min(g["scout_grade"], 20)
        elif g.get("stat_score") is not None and g["stat_score"] > 0:
            if source == "statsbomb":
                score_20 = min(g["stat_score"], 20)
            elif source == "understat":
                score_20 = min(g["stat_score"] * 1.7, 17)
            else:
                score_20 = min(g["stat_score"] * 2, 20)
        else:
            continue
        priority = SOURCE_PRIORITY.get(source, 0)
        existing = best.get(attr)
        if existing is None or priority > existing[1]:
            best[attr] = (score_20, priority)

    values = []
    used_attrs = set()
    for a in base_gk_attrs:
        if a in best:
            values.append(best[a][0])
            used_attrs.add(a)
        else:
            alias = ATTRIBUTE_ALIASES.get(a)
            if alias and alias in best and alias not in used_attrs:
                values.append(best[alias][0])
                used_attrs.add(alias)

    if not values:
        return None

    coverage_confidence = {4: 1.0, 3: 0.95, 2: 0.85, 1: 0.70}
    avg = sum(values) / len(values)
    full_score = min(avg * 5, 99)
    confidence = coverage_confidence.get(len(values), 0.70)
    return round(full_score * confidence)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Player Rating Calculator")
    print(f"  Dry run: {DRY_RUN}")
    print(f"  Force:   {FORCE}")

    cur = conn.cursor()

    # ── Incremental mode: only process changed players ──────────────────────
    incremental_ids = None
    if args.incremental and not args.player:
        try:
            from lib.incremental import get_changed_player_ids, mark_step_complete
            changed = get_changed_player_ids(
                conn, "ratings",
                tables=["attribute_grades", "player_profiles", "player_personality"],
            )
            if changed is None:
                print("  Incremental: first run — processing all players")
            elif not changed:
                print("  Incremental: no changes since last run — skipping")
                return
            else:
                incremental_ids = changed
                print(f"  Incremental: {len(changed)} players changed since last run")
        except ImportError:
            print("  [warn] lib.incremental not available — running full")

    # ── Step 1: Fetch all attribute grades ────────────────────────────────────

    where_clauses = []
    params = []

    if args.player:
        where_clauses.append("ag.player_id = %s")
        params.append(int(args.player))
    elif incremental_ids:
        where_clauses.append("ag.player_id = ANY(%s)")
        params.append(list(incremental_ids))

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    print("\n  Loading attribute grades...")
    cur.execute(f"""
        SELECT ag.player_id, ag.attribute, ag.scout_grade, ag.stat_score, ag.source
        FROM attribute_grades ag
        {where_sql}
        ORDER BY ag.player_id
    """, params)
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]

    if not rows:
        print("  No attribute grades found.")
        cur.close()
        conn.close()
        return

    # Group by player
    player_grades = {}
    for row in rows:
        d = dict(zip(cols, row))
        pid = d["player_id"]
        player_grades.setdefault(pid, []).append(d)

    print(f"  Players with attribute data: {len(player_grades)}")

    # ── Step 2: Fetch existing profiles (level, peak, position) ──────────────

    print("  Loading player profiles...")
    cur.execute("""
        SELECT person_id, position, level, peak, overall
        FROM player_profiles
        WHERE position IS NOT NULL
    """)
    profiles = {}
    for row in cur.fetchall():
        profiles[row[0]] = {
            "position": row[1],
            "level": row[2],
            "peak": row[3],
            "old_overall": row[4],
        }
    print(f"  Profiles with position: {len(profiles)}")

    # ── Step 2b: Load league strength factors ─────────────────────────────────

    from lib.calibration import load_player_league_strengths, validate_anchors
    player_strengths = load_player_league_strengths(conn)
    print(f"  Players with league strength: {len(player_strengths)}")

    # Load player names for anchor validation and top-N display
    cur.execute("SELECT id, name FROM people")
    player_names = {r[0]: r[1] for r in cur.fetchall()}

    # ── Step 3: Compute ratings ──────────────────────────────────────────────

    player_ids = list(player_grades.keys())
    if args.limit:
        player_ids = player_ids[:args.limit]

    results = []
    stats = {
        "computed": 0,
        "skipped_flat": 0,
        "skipped_no_position": 0,
        "updated_overall": 0,
    }
    compound_distribution = {"Technical": [], "Tactical": [], "Physical": [], "Mental": []}
    overall_distribution = []

    for pid in player_ids:
        grades = player_grades[pid]
        profile = profiles.get(pid)

        if not profile:
            stats["skipped_no_position"] += 1
            continue

        position = profile["position"]
        level = profile.get("level")
        peak = profile.get("peak")

        ls = player_strengths.get(pid, 1.0)
        anchored_scores, raw_scores = compute_model_scores(
            grades, level=level, position=position, league_strength=ls
        )

        if not has_differentiated_data(anchored_scores):
            stats["skipped_flat"] += 1
            continue

        # Anchored scores for compound/overall (tolerant of thin data)
        compound_scores = compute_compound_scores(anchored_scores, position=position)

        # For GKs, only count GK-relevant grades for coverage weighting.
        # Outfield metrics (creativity=1, vision=1 from understat) are noise for GKs.
        GK_RELEVANT_ATTRS = {
            "agility", "footwork", "handling", "reactions", "positioning",
            "awareness", "pass_range", "throwing", "aerial_duels", "close_range",
            "jumping", "acceleration", "pace", "composure", "communication",
        }
        if position == "GK":
            effective_grade_count = sum(
                1 for g in grades
                if g.get("source") != "eafc_inferred"
                and (g["attribute"].lower().replace(" ", "_") in GK_RELEVANT_ATTRS
                     or g.get("source") == "scout_assessment")
            )
        else:
            effective_grade_count = sum(
                1 for g in grades if g.get("source") != "eafc_inferred"
            )

        overall = compute_overall(compound_scores, position, level, peak, grade_count=effective_grade_count)

        if overall is None:
            continue

        stats["computed"] += 1
        overall_distribution.append(overall)

        for comp, score in compound_scores.items():
            compound_distribution[comp].append(score)

        # Blend raw + anchored scores for role computation.
        # Thin data → lean on anchored (level-boosted) scores.
        # Rich data → trust raw data-driven scores.
        grade_count = len(grades)
        if grade_count >= 50:
            role_scores = raw_scores
        else:
            # Blend factor: how much anchored influence (0.0 = all raw, 0.4 = heavy anchor)
            anchor_pct = max(0.05, 0.40 - grade_count * 0.007)
            role_scores = {}
            for k in set(raw_scores.keys()) | set(anchored_scores.keys()):
                r = raw_scores.get(k, 0)
                a = anchored_scores.get(k, 0)
                role_scores[k] = round(r * (1 - anchor_pct) + a * anchor_pct)

        # GK fix: the overridden MODEL_ATTRIBUTES["GK"] uses positioning/
        # awareness/pass_range/throwing for compound scoring, but data sources
        # actually provide agility/footwork/handling/reactions (the base model).
        # Recompute "GK" model score from base attrs so role selection works.
        if position == "GK" and "GK" not in role_scores:
            base_gk_score = _compute_base_gk_score(grades)
            if base_gk_score is not None:
                role_scores["GK"] = base_gk_score

        # Real grade count excludes proxy (always skipped) and eafc (unless fallback)
        has_real = any(g.get("source", "") not in ("eafc_inferred", "proxy_inferred") for g in grades)
        if has_real:
            effective_gc = sum(1 for g in grades if g.get("source") not in ("eafc_inferred", "proxy_inferred"))
        else:
            # EAFC-only player: count EAFC grades as effective
            effective_gc = sum(1 for g in grades if g.get("source") == "eafc_inferred")

        best_role, best_role_score = compute_best_role(role_scores, position, grade_count=effective_gc)

        # Minimum grade threshold: insufficient data → no role score.
        # Level 87+ players get a lower threshold (10) because they're
        # editorially calibrated and some stat data exists.
        # EAFC-only players get an even lower threshold (5) — it's sparse
        # but enough for a baseline level for OTP.
        # UI shows level instead for NULL role scores.
        if has_real:
            real_grade_count = sum(1 for g in grades if g.get("source") not in ("eafc_inferred", "proxy_inferred"))
            min_grades = 10 if level and level >= 87 else 15
        else:
            # EAFC-only: no real scouting data. Suppress role score entirely —
            # these are video game numbers, not scouting assessments.
            real_grade_count = 0
            min_grades = 1  # effectively always fails
        if real_grade_count < min_grades:
            best_role_score = None

        # Level floor: role score can't drop too far below level.
        # Gap WIDENS with sparse data — data must prove itself.
        if level and best_role_score is not None:
            if real_grade_count < 30:
                gap = 8
            elif real_grade_count < 50:
                gap = 5
            else:
                gap = 3
            level_floor = max(level - gap, 50)
            best_role_score = max(best_role_score, level_floor)

        results.append({
            "person_id": pid,
            "name": player_names.get(pid, "Unknown"),
            "overall": overall,
            "model_scores": anchored_scores,
            "compound_scores": compound_scores,
            "position": position,
            "level": level,
            "best_role": best_role,
            "best_role_score": best_role_score,  # raw, pre-floor
            "technical_score": compound_scores.get("Technical"),
            "physical_score": compound_scores.get("Physical"),
        })

    print(f"\n  Computed ratings: {stats['computed']}")
    print(f"  Skipped (flat data): {stats['skipped_flat']}")
    print(f"  Skipped (no position): {stats['skipped_no_position']}")

    # ── Step 3b: Position-normalised role scores ───────────────────────────
    # Defensive positions produce systematically higher raw role scores than
    # attacking/creative positions because defensive stat models cluster
    # higher. Compute the median role score for data-rich (30+ grade)
    # players per position, then scale each position so medians align.
    # This preserves within-position ordering while removing cross-position
    # inflation.

    # Position medians — diagnostic only.
    # Position deflation REMOVED: POSITION_WEIGHTS already handle position
    # fit within compute_best_role(). Adding a second correction on top
    # double-penalises positions with poor stat coverage (CD/WD have no
    # stat sources for marking, positioning, leadership → inflated median
    # from level floors → deflator crushes elite defenders).
    pos_scores_for_median = {}
    for r in results:
        if r.get("best_role_score") is not None and r["position"] != "GK":
            pos_scores_for_median.setdefault(r["position"], []).append(r["best_role_score"])

    print(f"\n  Position medians (no deflation applied):")
    for pos in sorted(pos_scores_for_median.keys()):
        scores = pos_scores_for_median[pos]
        if len(scores) >= 10:
            sorted_s = sorted(scores)
            med = sorted_s[len(sorted_s) // 2]
            top = sorted_s[-1]
            print(f"    {pos:3s}  median={med}  max={top}  n={len(scores)}")

    # ── Step 4: Distribution stats ───────────────────────────────────────────

    if overall_distribution:
        print(f"\n  Overall distribution:")
        print(f"    Min: {min(overall_distribution)}  Max: {max(overall_distribution)}  "
              f"Avg: {sum(overall_distribution) / len(overall_distribution):.1f}  "
              f"Median: {sorted(overall_distribution)[len(overall_distribution) // 2]}")

        for comp, vals in compound_distribution.items():
            if vals:
                print(f"    {comp:10s}  avg={sum(vals)/len(vals):.1f}  "
                      f"min={min(vals)}  max={max(vals)}  n={len(vals)}")

    # ── Step 5: Show samples ─────────────────────────────────────────────────

    if results:
        # Show top 20 by role score
        top_rs = sorted(
            [r for r in results if r.get("best_role_score") is not None],
            key=lambda r: -r["best_role_score"]
        )[:20]
        print(f"\n  Top 20 by role score:")
        for r in top_rs:
            print(f"    {r.get('name','?'):25s} {r['position']:3s}  RS={r['best_role_score']:2d}"
                  f"  lvl={r.get('level') or '?'}")

        # Show top defenders (CD/WD) — helps validate position normalisation
        top_def = sorted(
            [r for r in results if r.get("best_role_score") is not None and r["position"] in ("CD", "WD")],
            key=lambda r: -r["best_role_score"]
        )[:10]
        if top_def:
            print(f"\n  Top 10 defenders (CD/WD):")
            for r in top_def:
                print(f"    {r.get('name','?'):25s} {r['position']:3s}  RS={r['best_role_score']:2d}"
                      f"  lvl={r.get('level') or '?'}  role={r.get('best_role','?')}")

        # Show top 5 by overall
        top = sorted(results, key=lambda r: -r["overall"])[:5]
        print(f"\n  Top 5 rated players:")
        for r in top:
            name = r.get("name", f"#{r['person_id']}")
            compounds = ", ".join(f"{k}={v}" for k, v in r["compound_scores"].items())
            level_str = f" lvl={r['level']}" if r['level'] else ""
            role_str = f" role={r['best_role']}({r['best_role_score']})" if r.get('best_role') else ""
            print(f"    {name:25s} {r['position']:3s}  overall={r['overall']:2d}"
                  f"{level_str}{role_str}  [{compounds}]")

        # Anchor validation: compare key players against expected score ranges
        validate_anchors(results)

    # ── Step 6: Write results ────────────────────────────────────────────────

    if not DRY_RUN and results:
        now_iso = datetime.now(timezone.utc).isoformat()

        # Update player_profiles: overall + compound scores + best_role
        profile_updates = []
        for r in results:
            update = {
                "person_id": r["person_id"],
                "overall": float(r["overall"]),
            }
            if r.get("technical_score") is not None:
                update["technical_score"] = r["technical_score"]
            if r.get("physical_score") is not None:
                update["physical_score"] = r["physical_score"]
            if r.get("best_role"):
                update["best_role"] = r["best_role"]
            if r.get("best_role_score"):
                update["best_role_score"] = r["best_role_score"]
            profile_updates.append(update)

        for i in range(0, len(profile_updates), CHUNK_SIZE):
            chunk = profile_updates[i:i + CHUNK_SIZE]
            sb_client.table("player_profiles").upsert(
                chunk, on_conflict="person_id"
            ).execute()
            stats["updated_overall"] += len(chunk)

        print(f"\n  Updated player_profiles.overall: {stats['updated_overall']}")

        # Clear stale data for players that were skipped (flat/no data)
        # These keep old inflated scores from previous runs
        # Skip when processing a single player or subset — only clear on full runs
        processed_ids = [r["person_id"] for r in results]
        if processed_ids and not args.player and not args.limit:
            cur.execute("""
                UPDATE player_profiles
                SET best_role_score = NULL, best_role = NULL,
                    overall = NULL, technical_score = NULL, physical_score = NULL
                WHERE person_id NOT IN %s
                AND (best_role_score IS NOT NULL OR overall IS NOT NULL)
            """, (tuple(processed_ids),))
            stale_cleared = cur.rowcount
            if stale_cleared:
                print(f"  Cleared stale ratings/roles: {stale_cleared} players")

            # Clear stale compound scores from attribute_grades
            cur.execute("""
                DELETE FROM attribute_grades
                WHERE source = 'computed'
                AND attribute IN ('technical', 'tactical', 'physical', 'mental')
                AND player_id NOT IN %s
            """, (tuple(processed_ids),))
            stale_compounds = cur.rowcount
            if stale_compounds:
                print(f"  Cleared stale compound scores: {stale_compounds} rows")

        # Write compound scores as attribute_grades (source='computed')
        # stat_score is 0-20 scale, so convert from 0-100
        compound_rows = []
        for r in results:
            for compound, score in r["compound_scores"].items():
                compound_rows.append({
                    "player_id": r["person_id"],
                    "attribute": compound.lower(),
                    "stat_score": max(1, min(10, round(score / 10))),
                    "source": "computed",
                    "is_inferred": True,
                    "updated_at": now_iso,
                })

        if compound_rows:
            for i in range(0, len(compound_rows), CHUNK_SIZE):
                chunk = compound_rows[i:i + CHUNK_SIZE]
                sb_client.table("attribute_grades").upsert(
                    chunk, on_conflict="player_id,attribute,source"
                ).execute()
            print(f"  Wrote compound scores: {len(compound_rows)} rows")

    elif DRY_RUN:
        print(f"\n  [dry-run] would update {len(results)} player_profiles.overall values")
        print(f"  [dry-run] would write {len(results) * 4} compound score rows")

    # ── Summary ──────────────────────────────────────────────────────────────

    print(f"\n── Summary ───────────────────────────────────────────────────────")
    print(f"  Players processed:   {stats['computed']}")
    print(f"  Overall ratings:     {stats.get('updated_overall', 0)} written")
    print(f"  Skipped (flat):      {stats['skipped_flat']}")
    print(f"  Skipped (no pos):    {stats['skipped_no_position']}")
    if DRY_RUN:
        print("  (dry-run — no data was written)")

    # Mark step complete for incremental tracking
    if not DRY_RUN and args.incremental:
        try:
            from lib.incremental import mark_step_complete
            mark_step_complete(conn, "ratings", stats["computed"])
        except Exception:
            pass

    cur.close()
    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
