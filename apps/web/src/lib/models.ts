/**
 * SACROSANCT Model Constants — Single Source of Truth (TypeScript)
 *
 * 13 playing models, each averaging 4 core attributes.
 * Mirrors pipeline/lib/models.py — keep in sync.
 */

/** 13 SACROSANCT playing models, each with 4 core attributes */
export const MODEL_ATTRIBUTES: Record<string, string[]> = {
  Controller:  ["anticipation", "composure", "decisions", "tempo"],
  Commander:   ["communication", "concentration", "drive", "leadership"],
  Creator:     ["creativity", "unpredictability", "vision", "guile"],
  Target:      ["aerial_duels", "heading", "jumping", "volleys"],
  Sprinter:    ["acceleration", "balance", "movement", "pace"],
  Powerhouse:  ["aggression", "duels", "shielding", "stamina"],
  Cover:       ["awareness", "discipline", "interceptions", "positioning"],
  Engine:      ["intensity", "pressing", "stamina", "versatility"],
  Destroyer:   ["blocking", "clearances", "marking", "tackling"],
  Dribbler:    ["carries", "first_touch", "skills", "take_ons"],
  Passer:      ["pass_accuracy", "crossing", "pass_range", "through_balls"],
  Striker:     ["close_range", "mid_range", "long_range", "penalties"],
  GK:          ["agility", "footwork", "handling", "reactions"],
};

/** Short display codes for each model */
export const MODEL_SHORT: Record<string, string> = {
  Controller: "CTR", Commander: "CMD", Creator: "CRE", Target: "TGT",
  Sprinter: "SPR", Powerhouse: "PWR", Cover: "COV", Engine: "ENG",
  Destroyer: "DES", Dribbler: "DRB", Passer: "PAS", Striker: "STR", GK: "GK",
};

/** Source priority for fallback scoring (higher = preferred) */
export const SOURCE_PRIORITY: Record<string, number> = {
  scout_assessment: 5,
  statsbomb: 4,
  fbref: 3,
  api_football: 3,
  understat: 2,
  computed: 1,
  eafc_inferred: 0,
};

/** Attribute aliases for DB inconsistencies */
export const ATTR_ALIASES: Record<string, string> = {
  takeons: "take_ons",
  unpredicability: "unpredictability",
};
