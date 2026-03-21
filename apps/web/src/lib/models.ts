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

/** Human-readable labels for radar axes */
export const MODEL_LABEL: Record<string, string> = {
  Controller: "Control", Commander: "Command", Creator: "Create", Target: "Aerial",
  Sprinter: "Pace", Powerhouse: "Power", Cover: "Cover", Engine: "Engine",
  Destroyer: "Destroy", Dribbler: "Dribble", Passer: "Pass", Striker: "Shoot", GK: "GK",
};

/** Compound model labels — maps "Primary-Secondary" to human-readable name.
 *  Mirrors MODEL_LABELS in pipeline/lib/models.py — keep in sync. */
export const MODEL_LABELS: Record<string, string> = {
  // Single models
  Controller: "Controller", Commander: "Commander", Creator: "Creator",
  Target: "Target", Sprinter: "Sprinter", Powerhouse: "Powerhouse",
  Cover: "Cover", Engine: "Engine", Destroyer: "Destroyer",
  Dribbler: "Dribbler", Passer: "Passer", Striker: "Striker", GK: "Goalkeeper",
  // Controller primary
  "Controller-Cover": "Sentinel", "Controller-Creator": "Playmaker",
  "Controller-Destroyer": "Holder", "Controller-Dribbler": "Ball Magnet",
  "Controller-Engine": "Conductor", "Controller-Passer": "Regista",
  "Controller-Powerhouse": "Anchor", "Controller-Sprinter": "Glider",
  "Controller-Striker": "Clinical", "Controller-Target": "Composed CB",
  // Commander primary
  "Commander-Cover": "Captain", "Commander-Creator": "Talisman",
  "Commander-Destroyer": "Heart", "Commander-Dribbler": "Captain Marvel",
  "Commander-Engine": "General", "Commander-Passer": "Director",
  "Commander-Powerhouse": "Boss", "Commander-Sprinter": "Driving Force",
  "Commander-Striker": "Figurehead", "Commander-Target": "Air King",
  // Creator primary
  "Creator-Cover": "Quarterback CB", "Creator-Destroyer": "Regista",
  "Creator-Dribbler": "Magician", "Creator-Engine": "Catalyst",
  "Creator-Passer": "Maestro", "Creator-Powerhouse": "Power Playmaker",
  "Creator-Sprinter": "Counter King", "Creator-Striker": "Fantasista",
  "Creator-Target": "Target Playmaker",
  // Cover primary
  "Cover-Commander": "Anchor", "Cover-Controller": "Roll-Royce",
  "Cover-Creator": "Quarterback CB", "Cover-Destroyer": "Cornerback",
  "Cover-Dribbler": "Advancing CB", "Cover-Engine": "Mobile CB",
  "Cover-Passer": "Provider", "Cover-Powerhouse": "Stalwart",
  "Cover-Sprinter": "Recovery Ace", "Cover-Striker": "Libero Scorer",
  "Cover-Target": "Towering CB",
  // Engine primary
  "Engine-Commander": "Driver", "Engine-Controller": "Box-To-Box",
  "Engine-Cover": "Dynamo", "Engine-Creator": "Heartbeat",
  "Engine-Destroyer": "Machine", "Engine-Dribbler": "Tornate",
  "Engine-Passer": "Metronome", "Engine-Powerhouse": "Bison",
  "Engine-Sprinter": "Shuttler", "Engine-Striker": "Livewire",
  "Engine-Target": "Athlete",
  // Destroyer primary
  "Destroyer-Commander": "Leader", "Destroyer-Controller": "Lynchpin",
  "Destroyer-Cover": "Shield", "Destroyer-Creator": "Disruptor",
  "Destroyer-Dribbler": "Surge", "Destroyer-Engine": "Train",
  "Destroyer-Passer": "Recycler", "Destroyer-Powerhouse": "Rock",
  "Destroyer-Sprinter": "Shadow", "Destroyer-Striker": "Predator",
  "Destroyer-Target": "Centre Back",
  // Dribbler primary
  "Dribbler-Commander": "Captain Marvel", "Dribbler-Controller": "Ball Magnet",
  "Dribbler-Cover": "Modern Defender", "Dribbler-Creator": "Wizard",
  "Dribbler-Destroyer": "Chaos Creator", "Dribbler-Engine": "Solo Counter",
  "Dribbler-Powerhouse": "Tank", "Dribbler-Sprinter": "Flash",
  "Dribbler-Striker": "Spark", "Dribbler-Target": "Acrobat",
  // Passer primary
  "Passer-Commander": "General", "Passer-Controller": "Conductor",
  "Passer-Cover": "Provider", "Passer-Creator": "Silk",
  "Passer-Destroyer": "Recycler", "Passer-Engine": "Shuttle",
  "Passer-Powerhouse": "Midfield Rock", "Passer-Sprinter": "Transition King",
  "Passer-Target": "Quarterback",
  // Striker primary
  "Striker-Commander": "Talisman", "Striker-Controller": "Ice Man",
  "Striker-Cover": "Poacher", "Striker-Creator": "Assassin",
  "Striker-Destroyer": "Pressing Forward", "Striker-Engine": "Workhorse",
  "Striker-Powerhouse": "Rifle", "Striker-Sprinter": "Rocket",
  "Striker-Target": "Hitman",
  // Target primary
  "Target-Commander": "Air King", "Target-Controller": "Composed CB",
  "Target-Creator": "Target Playmaker", "Target-Destroyer": "Titan",
  "Target-Dribbler": "Acrobat", "Target-Engine": "Boxcrasher",
  "Target-Passer": "Quarterback", "Target-Powerhouse": "Colossus",
  "Target-Sprinter": "Leaper", "Target-Striker": "Tower",
  // Sprinter primary
  "Sprinter-Commander": "Driving Force", "Sprinter-Controller": "Glider",
  "Sprinter-Cover": "Flanker", "Sprinter-Creator": "Breakaway",
  "Sprinter-Destroyer": "Shadow", "Sprinter-Dribbler": "Flash",
  "Sprinter-Engine": "Shuttler", "Sprinter-Powerhouse": "Juggernaut",
  "Sprinter-Striker": "Ghost", "Sprinter-Target": "Leaper",
  // Powerhouse primary
  "Powerhouse-Commander": "Boss", "Powerhouse-Controller": "Anchor",
  "Powerhouse-Cover": "Dominator", "Powerhouse-Creator": "Power Playmaker",
  "Powerhouse-Destroyer": "Enforcer", "Powerhouse-Dribbler": "Tank",
  "Powerhouse-Engine": "Horse", "Powerhouse-Passer": "Midfield Rock",
  "Powerhouse-Sprinter": "Athlete", "Powerhouse-Striker": "Spearhead",
  "Powerhouse-Target": "Colossus",
  // GK compounds
  "GK-Controller": "Modern Keeper", "GK-Commander": "Commander",
  "GK-Cover": "Traditional Keeper", "GK-Passer": "Sweeper Keeper",
  "GK-Sprinter": "Sweeper Keeper",
};

/** Derive model label from an archetype string (e.g. "Controller-Passer" → "Regista") */
export function getModelLabel(archetype: string | null): string | null {
  if (!archetype) return null;
  return MODEL_LABELS[archetype] ?? archetype;
}

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
