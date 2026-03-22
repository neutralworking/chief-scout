"""
Valuation engine configuration — constants, thresholds, reference data.

All style compatibility tables, positional relevance tiers, and
calibration parameters live here as config, not learned values.
"""

from __future__ import annotations

# ── Scout dominance parameter ─────────────────────────────────────────────────

LAMBDA_MODES = {
    "dof_anchor": 0.95,       # DoF assessment near-absolute authority
    "scout_dominant": 0.7,
    "balanced": 0.5,
    "data_dominant": 0.3,
}
DEFAULT_MODE = "scout_dominant"

# DoF confidence → band width around DoF valuation
DOF_CONFIDENCE_BANDS = {
    "conviction": 0.10,   # ±10% around DoF valuation
    "informed": 0.20,     # ±20%
    "impression": 0.35,   # ±35%
}

# DoF commercial score → value multiplier
DOF_COMMERCIAL_MULTIPLIER = {
    10: 1.50, 9: 1.35, 8: 1.20, 7: 1.10,
    6: 1.05, 5: 1.00, 4: 0.95, 3: 0.85,
    2: 0.78, 1: 0.70,
}

# ── Confidence mappings ───────────────────────────────────────────────────────

CONFIDENCE_WEIGHTS = {
    "high": 1.0,
    "medium": 0.6,
    "low": 0.3,
}

# Noise scale for Monte Carlo perturbation (std dev as fraction of grade)
CONFIDENCE_NOISE_SCALE = {
    "high": 0.05,
    "medium": 0.15,
    "low": 0.30,
}

# Band width multipliers by profile confidence state
BAND_WIDTH_MULTIPLIERS = {
    "high": 1.0,       # ±15-20%
    "medium": 1.8,     # ±25-35%
    "low": 3.0,        # ±40-60%
    "very_low": 4.5,   # ±50-75%
}

MONTE_CARLO_SAMPLES = 100

# ── Disagreement threshold ────────────────────────────────────────────────────

DISAGREEMENT_THRESHOLD_STDEV = 1.0  # flag when delta > 1 std dev

# ── 13 Playing Models (from SACROSANCT) ───────────────────────────────────────

MODEL_ATTRIBUTES: dict[str, list[str]] = {
    "Controller":  ["anticipation", "composure", "decisions", "tempo"],
    "Commander":   ["communication", "concentration", "drive", "leadership"],
    "Creator":     ["creativity", "unpredictability", "vision", "guile"],
    "Target":      ["aerial_duels", "heading", "jumping", "volleys"],
    "Sprinter":    ["acceleration", "balance", "movement", "pace"],
    "Powerhouse":  ["aggression", "duels", "shielding", "stamina"],
    "Cover":       ["awareness", "discipline", "interceptions", "positioning"],
    "Engine":      ["intensity", "pressing", "stamina", "versatility"],
    "Destroyer":   ["blocking", "clearances", "marking", "tackling"],
    "Dribbler":    ["carries", "first_touch", "skills", "take_ons"],
    "Passer":      ["pass_accuracy", "crossing", "pass_range", "through_balls"],
    "Striker":     ["close_range", "mid_range", "long_range", "penalties"],
    "GK":          ["agility", "footwork", "handling", "reactions"],
}

ALL_MODELS = list(MODEL_ATTRIBUTES.keys())

COMPOUND_MODELS: dict[str, list[str]] = {
    "Technical": ["Dribbler", "Passer", "Striker", "GK"],
    "Tactical":  ["Cover", "Destroyer", "Engine"],
    "Physical":  ["Sprinter", "Powerhouse", "Target"],
    "Mental":    ["Controller", "Commander", "Creator"],
}

# ── Positional relevance tiers ────────────────────────────────────────────────
# Primary archetypes have highest weight, secondary moderate, tertiary marginal

POSITIONAL_ARCHETYPE_TIERS: dict[str, dict[str, float]] = {
    "GK":  {"GK": 1.0, "Cover": 0.6, "Commander": 0.5, "Controller": 0.3, "Passer": 0.3},
    "CD":  {"Destroyer": 1.0, "Cover": 0.9, "Commander": 0.7, "Target": 0.5, "Powerhouse": 0.4, "Passer": 0.3},
    "WD":  {"Engine": 0.9, "Dribbler": 0.7, "Passer": 0.7, "Sprinter": 0.6, "Cover": 0.6, "Destroyer": 0.3},
    "DM":  {"Cover": 1.0, "Destroyer": 0.9, "Controller": 0.8, "Passer": 0.5, "Commander": 0.4, "Powerhouse": 0.3},
    "CM":  {"Controller": 1.0, "Passer": 0.9, "Engine": 0.8, "Cover": 0.5, "Creator": 0.4},
    "WM":  {"Dribbler": 0.9, "Passer": 0.8, "Engine": 0.7, "Sprinter": 0.6, "Creator": 0.5},
    "AM":  {"Creator": 1.0, "Dribbler": 0.8, "Passer": 0.7, "Controller": 0.5, "Striker": 0.4, "Sprinter": 0.3},
    "WF":  {"Dribbler": 1.0, "Sprinter": 0.9, "Striker": 0.7, "Creator": 0.5, "Engine": 0.5},
    "CF":  {"Striker": 1.0, "Target": 0.7, "Sprinter": 0.6, "Powerhouse": 0.5, "Dribbler": 0.4, "Creator": 0.3},
}

# ── Style compatibility tables ────────────────────────────────────────────────
# Each tactical system has: required archetype thresholds, preferred style tags,
# concern style tags, personality pole preferences

TACTICAL_SYSTEMS: dict[str, dict] = {
    "gegenpress": {
        "description": "High-intensity pressing, rapid transitions, vertical play",
        "archetype_requirements": {
            "Engine": 55, "Sprinter": 50, "Destroyer": 45, "Powerhouse": 40,
        },
        "preferred_tags": [
            "Press Trigger", "Counter-Press Leader", "Transition Threat",
            "Compactor", "Recoverer", "Direct Runner", "Phase Skipper",
        ],
        "concern_tags": [
            "Deep Defender", "Hold-Up Target", "Positional Anchor",
        ],
        "personality_preferences": {"C": 0.7, "N": 0.6},  # Competitors, intrinsic drive
        "key_attributes": ["pressing", "stamina", "intensity", "aggression"],
    },
    "tiki_taka": {
        "description": "Possession-based, short passing, positional play",
        "archetype_requirements": {
            "Passer": 60, "Controller": 55, "Dribbler": 50, "Creator": 45,
        },
        "preferred_tags": [
            "Press Resistant", "Tempo Setter", "Positional Anchor",
            "Ball Progressor", "Link-Up Artist", "Half-Space Operator",
        ],
        "concern_tags": [
            "Direct Runner", "Phase Skipper", "Long Throw Weapon",
        ],
        "personality_preferences": {"A": 0.7, "P": 0.6},  # Analytical, composed
        "key_attributes": ["pass_accuracy", "composure", "first_touch", "vision"],
    },
    "counter_attacking": {
        "description": "Compact defence, rapid transition, direct attacking",
        "archetype_requirements": {
            "Cover": 55, "Destroyer": 50, "Sprinter": 55, "Striker": 45,
        },
        "preferred_tags": [
            "Transition Threat", "Phase Skipper", "Direct Runner",
            "Deep Defender", "Cover Shadow", "Third-Man Runner",
        ],
        "concern_tags": [
            "Tempo Setter", "Positional Anchor", "Drop Deep Creator",
        ],
        "personality_preferences": {"I": 0.6, "C": 0.6},  # Instinctive, competitive
        "key_attributes": ["pace", "acceleration", "movement", "positioning"],
    },
    "wing_play": {
        "description": "Width-focused, crossing, overlapping full-backs",
        "archetype_requirements": {
            "Dribbler": 55, "Passer": 50, "Sprinter": 55, "Target": 45,
        },
        "preferred_tags": [
            "Width Provider", "Overlap Runner", "Box Crasher",
            "Set-Piece Delivery", "Aerial Target", "Switch Player",
        ],
        "concern_tags": [
            "Inverted Player", "Half-Space Operator",
        ],
        "personality_preferences": {"X": 0.5},  # Extrinsic (feeds off crowd)
        "key_attributes": ["crossing", "pace", "heading", "aerial_duels"],
    },
    "catenaccio": {
        "description": "Defensive solidity, disciplined shape, clinical finishing",
        "archetype_requirements": {
            "Cover": 60, "Destroyer": 55, "Commander": 50, "Controller": 45,
        },
        "preferred_tags": [
            "Deep Defender", "Cover Shadow", "Compactor", "Controlled Aggressor",
            "High Line Defender", "Tactical Fouler",
        ],
        "concern_tags": [
            "Press Trigger", "Counter-Press Leader", "Width Provider",
        ],
        "personality_preferences": {"A": 0.6, "L": 0.6, "P": 0.5},
        "key_attributes": ["positioning", "marking", "tackling", "discipline"],
    },
    "total_football": {
        "description": "Positional interchange, universal players, fluid roles",
        "archetype_requirements": {
            "Engine": 50, "Passer": 50, "Controller": 50, "Dribbler": 45,
        },
        "preferred_tags": [
            "Ball Progressor", "Press Resistant", "Inverted Player",
            "Line Breaker", "Counter-Press Leader", "Two-Footed",
        ],
        "concern_tags": [
            "Positional Anchor", "Deep Defender",
        ],
        "personality_preferences": {"A": 0.5, "N": 0.6},
        "key_attributes": ["versatility", "vision", "decisions", "stamina"],
    },
}

# Map TACTICAL_SYSTEMS keys to tactical_philosophies.slug in DB
PHILOSOPHY_SLUG_MAP: dict[str, str] = {
    "gegenpress": "gegenpressing",
    "tiki_taka": "la_masia",
    "counter_attacking": "cholismo",
    "wing_play": "fergie_time",
    "catenaccio": "catenaccio",
    "total_football": "total_football",
}

# ── Personality tag value adjustments ─────────────────────────────────────────

RISK_TAGS = {
    "Contract Sensitive": -0.06,
    "Commercially Motivated": -0.05,
    "Environmental Sensitivity": -0.04,
    "Individual Agenda": -0.04,
    "High Exit Probability": -0.08,
    "High Maintenance": -0.04,
    "Disciplinary Vulnerability": -0.05,
    "Declining Trajectory": -0.10,
    "Unproven at Sustained Level": -0.06,
}

VALUE_TAGS = {
    "Undroppable": 0.08,
    "Culture Setter": 0.06,
    "Proven at Level": 0.07,
    "Big Game Player": 0.05,
    "Context Neutral": 0.04,
    "Captain Material": 0.04,
    "Low Maintenance": 0.03,
}

NEUTRAL_TAGS = {
    "One Club Profile": 0.0,
    "High Mobility Profile": 0.0,
    "Late Bloomer": 0.0,
    "Mercurial": 0.0,
}

# ── Age curve parameters (position-specific) ─────────────────────────────────

# Peak age ranges and decline rates per position group
AGE_CURVES: dict[str, dict] = {
    "GK":  {"peak_start": 27, "peak_end": 33, "youth_premium_peak": 21, "decline_rate": 0.06},
    "CD":  {"peak_start": 26, "peak_end": 32, "youth_premium_peak": 21, "decline_rate": 0.08},
    "WD":  {"peak_start": 25, "peak_end": 30, "youth_premium_peak": 21, "decline_rate": 0.10},
    "DM":  {"peak_start": 26, "peak_end": 31, "youth_premium_peak": 22, "decline_rate": 0.08},
    "CM":  {"peak_start": 25, "peak_end": 30, "youth_premium_peak": 22, "decline_rate": 0.09},
    "WM":  {"peak_start": 24, "peak_end": 29, "youth_premium_peak": 20, "decline_rate": 0.11},
    "AM":  {"peak_start": 24, "peak_end": 29, "youth_premium_peak": 21, "decline_rate": 0.10},
    "WF":  {"peak_start": 23, "peak_end": 28, "youth_premium_peak": 20, "decline_rate": 0.12},
    "CF":  {"peak_start": 25, "peak_end": 30, "youth_premium_peak": 21, "decline_rate": 0.09},
}

# ── Position scarcity multipliers ─────────────────────────────────────────────

POSITION_SCARCITY = {
    "DM": 1.20,
    "WM": 1.15,
    "AM": 1.10,
    "WD": 1.05,
    "CF": 1.00,
    "WF": 1.00,
    "CD": 0.98,
    "CM": 0.97,
    "GK": 0.85,
}

# ── League strength adjustments ───────────────────────────────────────────────

# Derived from UEFA country coefficients (script 70_coefficients_ingest.py).
# strength_factor = 0.40 + 0.75 * sqrt(coeff / max_coeff)
# Valuation uses these as multiplicative adjustments on base market value.
LEAGUE_STRENGTH = {
    "Premier League": 1.150,
    "La Liga": 1.081,
    "Serie A": 1.096,
    "Bundesliga": 1.064,
    "Ligue 1": 1.032,
    "Eredivisie": 0.971,
    "Primeira Liga": 0.960,
    "Jupiler Pro League": 0.903,
    "Super Lig": 0.885,
    "Austrian Bundesliga": 0.869,
    "Scottish Premiership": 0.858,
    "Greek Super League": 0.843,
    "Swiss Super League": 0.836,
    "Eliteserien": 0.830,
    "Serbian Super Liga": 0.827,
    "Danish Superliga": 0.819,
    "Allsvenskan": 0.805,
    "Croatian HNL": 0.791,
    "Czech Liga": 0.894,
    "Ekstraklasa": 0.776,
    "Romanian Liga I": 0.768,
    "Bulgarian First League": 0.740,
    "Championship": 0.920,
    # Non-UEFA
    "Brasileirao Serie A": 0.750,
    "Argentine Liga Profesional": 0.720,
    "Liga MX": 0.650,
    "Saudi Pro League": 0.620,
    "MLS": 0.600,
    "Colombian Primera A": 0.580,
    "K League 1": 0.550,
    "A-League": 0.520,
    "Chinese Super League": 0.500,
    "default": 0.500,
}

# ── Contract cliff effects ────────────────────────────────────────────────────

CONTRACT_MULTIPLIERS = {
    0: 0.10,    # expired / free agent
    0.5: 0.40,  # 6 months
    1: 0.60,    # 1 year
    2: 0.80,    # 2 years
    3: 0.92,    # 3 years
    4: 1.00,    # 4 years
    5: 1.02,    # 5 years (slight premium — locked in)
}

# ── Low-observability attributes (capped at Medium confidence from stats) ─────

LOW_OBSERVABILITY_ATTRIBUTES = {
    "vision", "anticipation", "composure", "decisions", "creativity",
    "communication", "concentration", "drive", "leadership", "guile",
    "unpredictability", "tempo", "discipline", "awareness",
}

# ── Source priority (from SACROSANCT) ─────────────────────────────────────────

SOURCE_PRIORITY = {
    "scout_assessment": 5,
    "fbref": 4,
    "api_football": 3,
    "statsbomb": 3,
    "understat": 2,
    "computed": 1,
    "eafc_inferred": 0,
}

# ── Transfer window adjustments ───────────────────────────────────────────────

WINDOW_MULTIPLIERS = {
    "summer": 1.0,
    "winter": 1.10,   # scarcity premium
    "out_of_window": 0.95,  # pre-agreement discount
}

# ── National team status premium ──────────────────────────────────────────────

NATIONAL_TEAM_PREMIUM = {
    "star": 1.12,
    "regular": 1.06,
    "called_up": 1.02,
    "none": 1.0,
}
