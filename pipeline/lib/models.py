"""
SACROSANCT Model Constants — Single Source of Truth (Python)

13 playing models, each averaging 4 core attributes.
Mirrors apps/web/src/lib/models.ts — keep in sync.
"""

# 13 SACROSANCT playing models, each with 4 core attributes
MODEL_ATTRIBUTES = {
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

# Short display codes for each model
MODEL_SHORT = {
    "Controller": "CTR", "Commander": "CMD", "Creator": "CRE", "Target": "TGT",
    "Sprinter": "SPR", "Powerhouse": "PWR", "Cover": "COV", "Engine": "ENG",
    "Destroyer": "DES", "Dribbler": "DRB", "Passer": "PAS", "Striker": "STR", "GK": "GK",
}

# Source priority for fallback scoring (higher = preferred)
SOURCE_PRIORITY = {
    "scout_assessment": 5,
    "statsbomb": 4,
    "fbref": 3,
    "api_football": 3,
    "understat": 2,
    "computed": 1,
    "eafc_inferred": 0,
}

# Attribute aliases for DB inconsistencies
ATTR_ALIASES = {
    "takeons": "take_ons",
    "Leadership": "leadership",
    "unpredicability": "unpredictability",
}
