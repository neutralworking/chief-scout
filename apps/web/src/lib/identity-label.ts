/**
 * Identity Label — compound scouting descriptor for player cards.
 *
 * Combines blueprint with personality-derived adjective ONLY when the
 * blueprint alone is too generic or duplicates the role name.
 * When the blueprint is already distinctive, it stands alone.
 *
 * Goal: every player gets a 1-3 word label a DOF would use in a meeting.
 */

import { PERSONALITY_TYPES } from "./personality";

// ── Personality name → scouting adjective ──────────────────────────────────
// These must sound like something a scout would say, not a thesaurus.
const PERSONALITY_ADJECTIVE: Record<string, string> = {
  General: "Disciplined",
  Machine: "Relentless",
  Conductor: "Composed",
  Professor: "Cerebral",
  Captain: "Commanding",
  Mamba: "Clinical",
  Maestro: "Elegant",
  Guardian: "Steady",
  Catalyst: "Explosive",
  Enforcer: "Imposing",
  Technician: "Precise",
  Orchestrator: "Controlling",
  Maverick: "Unpredictable",
  Spark: "Dynamic",
  Livewire: "Electric",
  Playmaker: "Creative",
};

// ── Generic blueprints that benefit from a prefix ──────────────────────────
// These appear 3+ times in the DB or are too vague to be an identity.
const GENERIC_BLUEPRINTS = new Set([
  "Complete Striker",
  "Traditional CB",
  "Holding Midfielder",
  "Defensive Full-Back",
  "Two-Way Full-Back",
  "Shot-Stopper",
  "Box-to-Box",
  "Defender",
  "Full-Back",
  "Midfielder",
  "Wide Midfielder",
  "Striker",
  "Winger",
]);

// ── Synonyms for redundant blueprints ──────────────────────────────────────
// When blueprint = role name, swap to a shorter/more evocative synonym first.
const BLUEPRINT_SYNONYM: Record<string, string> = {
  "Inside Forward": "Attacker",
  "Shotstopper": "Shot-Stopper",
};

// ── Redundant pairs: (blueprint, role) where blueprint = role name ─────────
// When the blueprint just echoes the role, treat it as generic.
function isRedundant(blueprint: string, bestRole: string | null): boolean {
  if (!bestRole) return false;
  const bp = blueprint.toLowerCase().replace(/[-\s]/g, "");
  const role = bestRole.toLowerCase().replace(/[-\s]/g, "");
  return bp === role;
}

// ── Specific overrides for combos that sound bad ───────────────────────────
// (adjective, blueprint) → replacement. Catches redundancy and awkwardness.
const OVERRIDE: Record<string, string> = {
  // Redundant adjective + blueprint
  "Clinical·Clinical Finisher": "Clinical Finisher",
  "Explosive·Explosive Winger": "Explosive Winger",
  "Commanding·Commander": "Commander",
  "Creative·Playmaker": "Playmaker",
  "Composed·Conductor": "Conductor",

  // Traditional CB
  "Explosive·Traditional CB": "Aggressive Defender",
  "Imposing·Traditional CB": "Imposing Defender",
  "Composed·Traditional CB": "Composed Defender",
  "Disciplined·Traditional CB": "Disciplined Defender",
  "Commanding·Traditional CB": "Commanding Defender",
  "Relentless·Traditional CB": "Relentless Defender",
  "Clinical·Traditional CB": "Reading Defender",
  "Cerebral·Traditional CB": "Cerebral Defender",
  "Steady·Traditional CB": "Resolute Defender",

  // Holding Midfielder
  "Relentless·Holding Midfielder": "Tireless Screen",
  "Imposing·Holding Midfielder": "Imposing Anchor",
  "Commanding·Holding Midfielder": "Commanding Screen",
  "Composed·Holding Midfielder": "Composed Shield",
  "Disciplined·Holding Midfielder": "Disciplined Shield",
  "Explosive·Holding Midfielder": "Aggressive Screen",
  "Clinical·Holding Midfielder": "Clinical Shield",

  // Defensive Full-Back
  "Explosive·Defensive Full-Back": "Aggressive Full-Back",
  "Imposing·Defensive Full-Back": "Aggressive Full-Back",
  "Disciplined·Defensive Full-Back": "Disciplined Full-Back",
  "Precise·Defensive Full-Back": "Precise Full-Back",
  "Steady·Defensive Full-Back": "Resolute Full-Back",
  "Cerebral·Defensive Full-Back": "Cerebral Full-Back",
  "Commanding·Defensive Full-Back": "Commanding Full-Back",

  // Complete Striker — vary by adjective for personality spread
  "Imposing·Complete Striker": "Powerhouse Striker",
  "Explosive·Complete Striker": "Explosive Striker",
  "Commanding·Complete Striker": "Commanding Striker",
  "Relentless·Complete Striker": "Relentless Striker",
  "Clinical·Complete Striker": "Clinical Striker",
  "Disciplined·Complete Striker": "Clinical Striker",
  "Composed·Complete Striker": "Composed Striker",
  "Elegant·Complete Striker": "Elegant Striker",
  "Unpredictable·Complete Striker": "Unpredictable Striker",
  "Dynamic·Complete Striker": "Dynamic Striker",

  // Two-Way Full-Back
  "Relentless·Two-Way Full-Back": "Tireless Full-Back",
  "Imposing·Two-Way Full-Back": "Imposing Full-Back",
  "Commanding·Two-Way Full-Back": "Commanding Full-Back",
  "Explosive·Two-Way Full-Back": "Aggressive Full-Back",

  // Shot-Stopper
  "Disciplined·Shot-Stopper": "Commanding Keeper",
  "Imposing·Shot-Stopper": "Imposing Keeper",
  "Clinical·Shot-Stopper": "Clinical Keeper",
  "Commanding·Shot-Stopper": "Commanding Keeper",

  // Attacker (synonym for redundant Inside Forward)
  "Unpredictable·Attacker": "Unpredictable Attacker",
  "Imposing·Attacker": "Direct Attacker",
  "Explosive·Attacker": "Explosive Attacker",
  "Clinical·Attacker": "Clinical Attacker",
  "Dynamic·Attacker": "Dynamic Attacker",
  "Electric·Attacker": "Electric Attacker",

  // Defender (ultra-generic fallback)
  "Explosive·Defender": "Aggressive Defender",
  "Imposing·Defender": "Imposing Defender",
  "Disciplined·Defender": "Disciplined Defender",
  "Commanding·Defender": "Commanding Defender",

  // Box-to-Box (vague)
  "Relentless·Box-to-Box": "Relentless Midfielder",
  "Imposing·Box-to-Box": "Imposing Midfielder",
  "Disciplined·Box-to-Box": "Disciplined Midfielder",
  "Explosive·Box-to-Box": "Dynamic Midfielder",
};

/**
 * Compute a 1-3 word identity label for a player.
 *
 * @param blueprint - From player_profiles.blueprint (pipeline 37 output)
 * @param bestRole - The tactical role name
 * @param personalityType - 4-letter personality code (e.g., "ANLC")
 * @returns Identity label string, or null if no blueprint
 */
export function computeIdentityLabel(
  blueprint: string | null | undefined,
  bestRole: string | null | undefined,
  personalityType: string | null | undefined,
): string | null {
  if (!blueprint) return null;

  // Apply synonym if blueprint is redundant with role (e.g. Inside Forward → Attacker)
  let bp = blueprint;
  if (isRedundant(bp, bestRole ?? null) && BLUEPRINT_SYNONYM[bp]) {
    bp = BLUEPRINT_SYNONYM[bp];
  }

  // If blueprint is distinctive AND not redundant with role, use it as-is
  const isGeneric = GENERIC_BLUEPRINTS.has(bp);
  const redundant = isRedundant(bp, bestRole ?? null);

  if (!isGeneric && !redundant) {
    return bp;
  }

  // Need a prefix — get personality adjective
  if (!personalityType) return bp; // no personality = can't improve

  const pt = PERSONALITY_TYPES[personalityType];
  if (!pt) return bp;

  const adjective = PERSONALITY_ADJECTIVE[pt.name];
  if (!adjective) return bp;

  // Check for override
  const key = `${adjective}·${bp}`;
  if (OVERRIDE[key]) return OVERRIDE[key];

  // Default compound: "Adjective Blueprint"
  return `${adjective} ${bp}`;
}
