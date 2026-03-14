/**
 * Valuation engine configuration — constants, thresholds, reference data.
 * TypeScript port of valuation_core/config.py
 */

// ── Scout dominance parameter ─────────────────────────────────────────────────

export const LAMBDA_MODES: Record<string, number> = {
  scout_dominant: 0.7,
  balanced: 0.5,
  data_dominant: 0.3,
};

// ── Confidence mappings ───────────────────────────────────────────────────────

export const CONFIDENCE_WEIGHTS: Record<string, number> = {
  high: 1.0,
  medium: 0.6,
  low: 0.3,
};

export const CONFIDENCE_NOISE_SCALE: Record<string, number> = {
  high: 0.05,
  medium: 0.15,
  low: 0.30,
};

export const BAND_WIDTH_MULTIPLIERS: Record<string, number> = {
  high: 1.0,
  medium: 1.8,
  low: 3.0,
  very_low: 4.5,
};

export const MONTE_CARLO_SAMPLES = 100;
export const DISAGREEMENT_THRESHOLD_STDEV = 1.0;

// ── 13 Playing Models ───────────────────────────────────────────────────────

export const MODEL_ATTRIBUTES: Record<string, string[]> = {
  Controller: ["anticipation", "composure", "decisions", "tempo"],
  Commander: ["communication", "concentration", "drive", "leadership"],
  Creator: ["creativity", "unpredictability", "vision", "guile"],
  Target: ["aerial_duels", "heading", "jumping", "volleys"],
  Sprinter: ["acceleration", "balance", "movement", "pace"],
  Powerhouse: ["aggression", "duels", "shielding", "stamina"],
  Cover: ["awareness", "discipline", "interceptions", "positioning"],
  Engine: ["intensity", "pressing", "stamina", "versatility"],
  Destroyer: ["blocking", "clearances", "marking", "tackling"],
  Dribbler: ["carries", "first_touch", "skills", "take_ons"],
  Passer: ["pass_accuracy", "crossing", "pass_range", "through_balls"],
  Striker: ["close_range", "mid_range", "long_range", "penalties"],
  GK: ["agility", "footwork", "handling", "reactions"],
};

// ── Positional archetype tiers ────────────────────────────────────────────────

export const POSITIONAL_ARCHETYPE_TIERS: Record<string, Record<string, number>> = {
  GK: { GK: 1.0, Cover: 0.6, Commander: 0.5, Controller: 0.3, Passer: 0.3 },
  CD: { Destroyer: 1.0, Cover: 0.9, Commander: 0.7, Target: 0.5, Powerhouse: 0.4, Passer: 0.3 },
  WD: { Engine: 0.9, Dribbler: 0.7, Passer: 0.7, Sprinter: 0.6, Cover: 0.6, Destroyer: 0.3 },
  DM: { Cover: 1.0, Destroyer: 0.9, Controller: 0.8, Passer: 0.5, Commander: 0.4, Powerhouse: 0.3 },
  CM: { Controller: 1.0, Passer: 0.9, Engine: 0.8, Cover: 0.5, Creator: 0.4 },
  WM: { Dribbler: 0.9, Passer: 0.8, Engine: 0.7, Sprinter: 0.6, Creator: 0.5 },
  AM: { Creator: 1.0, Dribbler: 0.8, Passer: 0.7, Controller: 0.5, Striker: 0.4, Sprinter: 0.3 },
  WF: { Dribbler: 1.0, Sprinter: 0.9, Striker: 0.7, Creator: 0.5, Engine: 0.5 },
  CF: { Striker: 1.0, Target: 0.7, Sprinter: 0.6, Powerhouse: 0.5, Dribbler: 0.4, Creator: 0.3 },
};

// ── Age curve parameters ────────────────────────────────────────────────────

export const AGE_CURVES: Record<string, { peak_start: number; peak_end: number; youth_premium_peak: number; decline_rate: number }> = {
  GK: { peak_start: 27, peak_end: 33, youth_premium_peak: 21, decline_rate: 0.06 },
  CD: { peak_start: 26, peak_end: 32, youth_premium_peak: 21, decline_rate: 0.08 },
  WD: { peak_start: 25, peak_end: 30, youth_premium_peak: 21, decline_rate: 0.10 },
  DM: { peak_start: 26, peak_end: 31, youth_premium_peak: 22, decline_rate: 0.08 },
  CM: { peak_start: 25, peak_end: 30, youth_premium_peak: 22, decline_rate: 0.09 },
  WM: { peak_start: 24, peak_end: 29, youth_premium_peak: 20, decline_rate: 0.11 },
  AM: { peak_start: 24, peak_end: 29, youth_premium_peak: 21, decline_rate: 0.10 },
  WF: { peak_start: 23, peak_end: 28, youth_premium_peak: 20, decline_rate: 0.12 },
  CF: { peak_start: 25, peak_end: 30, youth_premium_peak: 21, decline_rate: 0.09 },
};

// ── Position scarcity ───────────────────────────────────────────────────────

export const POSITION_SCARCITY: Record<string, number> = {
  DM: 1.20, WM: 1.15, AM: 1.10, WD: 1.05,
  CF: 1.00, WF: 1.00, CD: 0.98, CM: 0.97, GK: 0.85,
};

// ── League strength ───────────────────────────────────────────────────────

export const LEAGUE_STRENGTH: Record<string, number> = {
  "Premier League": 1.15, "La Liga": 1.05, "Bundesliga": 1.00,
  "Serie A": 1.00, "Ligue 1": 0.95, "Eredivisie": 0.80,
  "Primeira Liga": 0.78, "Super Lig": 0.75, "Championship": 0.70,
  "Belgian Pro League": 0.70, "Scottish Premiership": 0.60, "MLS": 0.55,
  default: 0.50,
};

// ── Contract multipliers ───────────────────────────────────────────────────

export const CONTRACT_MULTIPLIERS: Record<number, number> = {
  0: 0.10, 0.5: 0.40, 1: 0.60, 2: 0.80, 3: 0.92, 4: 1.00, 5: 1.02,
};

// ── Personality tags ───────────────────────────────────────────────────────

export const RISK_TAGS: Record<string, number> = {
  "Contract Sensitive": -0.06,
  "Commercially Motivated": -0.05,
  "Environmental Sensitivity": -0.04,
  "Individual Agenda": -0.04,
  "High Exit Probability": -0.08,
  "High Maintenance": -0.04,
  "Disciplinary Vulnerability": -0.05,
  "Declining Trajectory": -0.10,
  "Unproven at Sustained Level": -0.06,
};

export const VALUE_TAGS: Record<string, number> = {
  Undroppable: 0.08,
  "Culture Setter": 0.06,
  "Proven at Level": 0.07,
  "Big Game Player": 0.05,
  "Context Neutral": 0.04,
  "Captain Material": 0.04,
  "Low Maintenance": 0.03,
};

// ── Source priority ───────────────────────────────────────────────────────

export const SOURCE_PRIORITY: Record<string, number> = {
  scout_assessment: 5, fbref: 4, statsbomb: 3,
  understat: 2, computed: 1, eafc_inferred: 0,
};

// ── Low-observability attributes ────────────────────────────────────────────

export const LOW_OBSERVABILITY_ATTRIBUTES = new Set([
  "vision", "anticipation", "composure", "decisions", "creativity",
  "communication", "concentration", "drive", "leadership", "guile",
  "unpredictability", "tempo", "discipline", "awareness",
]);
