/**
 * Trait × Role Impact Matrix
 *
 * Maps behavioral/tactical traits to their impact on specific tactical roles.
 * Positive values = trait helps in this role, negative = hinders.
 * Scale: -10 to +10 per trait×role combination.
 *
 * Trait categories:
 * - Style: how the player approaches the game aesthetically
 * - Physical: physical characteristics beyond raw athleticism
 * - Tactical: game-reading and system-specific abilities
 * - Behavioral: mental patterns in match contexts
 */

export interface TraitDefinition {
  name: string;
  category: "style" | "physical" | "tactical" | "behavioral";
  description: string;
}

export const TRAIT_DEFINITIONS: TraitDefinition[] = [
  // Style
  { name: "flamboyant", category: "style", description: "Showmanship, flair, crowd-pleasing moves" },
  { name: "direct", category: "style", description: "Takes the most direct route to goal" },
  { name: "patient", category: "style", description: "Keeps possession, waits for the right moment" },
  { name: "elegant", category: "style", description: "Effortless technique, aesthetic quality" },

  // Physical
  { name: "long_throws", category: "physical", description: "Effective long throw-in specialist" },
  { name: "aerial_threat", category: "physical", description: "Dominant in aerial duels" },
  { name: "endurance", category: "physical", description: "Maintains intensity over 90+ minutes" },

  // Tactical
  { name: "press_resistant", category: "tactical", description: "Retains composure under high press" },
  { name: "progressive_carrier", category: "tactical", description: "Drives forward with the ball consistently" },
  { name: "set_piece_specialist", category: "tactical", description: "Dangerous from set pieces (delivery or finishing)" },
  { name: "positional_discipline", category: "tactical", description: "Holds position, rarely out of structure" },
  { name: "high_press", category: "tactical", description: "Effective presser in opposition third" },
  { name: "counter_attack_threat", category: "tactical", description: "Devastating on the break" },
  { name: "build_up_contributor", category: "tactical", description: "Contributes to build-up play from deep" },

  // Behavioral
  { name: "big_game_player", category: "behavioral", description: "Raises level in high-stakes matches" },
  { name: "inconsistent", category: "behavioral", description: "Performance varies significantly match to match" },
  { name: "clutch", category: "behavioral", description: "Delivers in decisive moments (late goals, penalties)" },
  { name: "hot_headed", category: "behavioral", description: "Prone to cards, confrontations, losing focus" },
  { name: "quiet_leader", category: "behavioral", description: "Leads by example rather than vocal command" },

  // Editorial — playing style descriptors (not stat-derived)
  { name: "dribble_artist", category: "style", description: "Beating players is the identity, not just a stat" },
  { name: "playmaker_vision", category: "style", description: "Sees passes nobody else does" },
  { name: "through_ball_king", category: "style", description: "Threading the needle is the signature" },
  { name: "one_touch_play", category: "style", description: "First-time combinations, wall passes" },
  { name: "tempo_controller", category: "style", description: "Dictates match speed, slows and accelerates at will" },
  { name: "long_range_threat", category: "tactical", description: "Scores and shoots from distance" },
  { name: "fox_in_the_box", category: "tactical", description: "Poacher instinct, lives in the 6-yard area" },
  { name: "sweeper_reader", category: "tactical", description: "Reads danger before it happens, intercepts everything" },
  { name: "brick_wall", category: "tactical", description: "Unbeatable 1v1 defender" },
  { name: "hard_man", category: "tactical", description: "Physical intimidation, tackles define reputation" },
  { name: "captain_leader", category: "tactical", description: "On-pitch authority beyond the armband" },
  { name: "target_man", category: "physical", description: "Aerial focal point, hold-up play" },
  { name: "pace_merchant", category: "physical", description: "Raw speed defines the game" },
];

/**
 * TRAIT_ROLE_IMPACT[traitName][roleName] = impact (-10 to +10)
 * Only significant impacts are listed — unlisted combinations = 0 impact.
 */
export const TRAIT_ROLE_IMPACT: Record<string, Record<string, number>> = {
  press_resistant: {
    "Regista": 10, "Ball-Playing CB": 8, "Deep Playmaker": 8, "Advanced Playmaker": 6,
    "Inverted Full-Back": 7, "Mezzala": 5, "Falso Nove": 7, "Trequartista": 6,
    "Sweeper Keeper": 6, "Ball-Carrying CB": 8,
  },
  flamboyant: {
    "Trequartista": 8, "Inside Forward": 5, "Inverted Winger": 5, "Falso Nove": 4,
    "Wide Playmaker": 4, "Direct Winger": 3,
    "Anchor": -5, "Stopper": -4, "Ball-Winner": -3,
  },
  direct: {
    "Direct Winger": 8, "Wide Forward": 7, "Inside Forward": 6, "Pressing Forward": 5,
    "Poacher": 4, "Seconda Punta": 5, "Counter Attack Threat": 6,
    "Regista": -3, "Deep Playmaker": -3, "Falso Nove": -2,
  },
  patient: {
    "Regista": 7, "Deep Playmaker": 7, "Ball-Playing CB": 5, "Advanced Playmaker": 6,
    "Anchor": 5, "Inverted Full-Back": 5, "Controller": 6,
    "Direct Winger": -4, "Pressing Forward": -3,
  },
  elegant: {
    "Trequartista": 7, "Regista": 6, "Falso Nove": 5, "Advanced Playmaker": 5,
    "Wide Playmaker": 5, "Inverted Winger": 5, "Ball-Playing CB": 4,
    "Stopper": -3, "Ball-Winner": -2,
  },
  aerial_threat: {
    "Prima Punta": 10, "Stopper": 7, "Complete Forward": 5, "Ball-Playing CB": 3,
    "Sweeper": 3,
    "Falso Nove": -2, "Regista": -1,
  },
  endurance: {
    "Box-to-Box": 8, "Engine": 8, "Wing-Back": 8, "Pressing Forward": 7,
    "Ball-Winner": 6, "Overlapping Full-Back": 6, "Mezzala": 5,
    "Wide Forward": 4, "Direct Winger": 4,
  },
  progressive_carrier: {
    "Ball-Carrying CB": 10, "Mezzala": 8, "Inverted Full-Back": 7, "Box-to-Box": 6,
    "Wide Playmaker": 5, "Inside Forward": 5, "Direct Winger": 4,
    "Anchor": -3, "Poacher": -2,
  },
  set_piece_specialist: {
    "Wide Provider": 8, "Advanced Playmaker": 6, "Deep Playmaker": 5,
    "Prima Punta": 5, "Complete Forward": 3,
  },
  positional_discipline: {
    "Anchor": 10, "Sweeper": 8, "Stopper": 7, "Cover": 7,
    "Ball-Playing CB": 6, "Inverted Full-Back": 6, "Shot Stopper": 5,
    "Trequartista": -4, "Raumdeuter": -3,
  },
  high_press: {
    "Pressing Forward": 10, "Ball-Winner": 8, "Seconda Punta": 6,
    "Direct Winger": 5, "Complete Forward": 5, "Engine": 5,
    "Mezzala": 4, "Wide Forward": 4,
    "Regista": -3, "Sweeper": -2,
  },
  counter_attack_threat: {
    "Wide Forward": 8, "Inside Forward": 7, "Direct Winger": 7,
    "Seconda Punta": 6, "Poacher": 5, "Overlapping Full-Back": 4,
  },
  build_up_contributor: {
    "Ball-Playing CB": 8, "Ball-Carrying CB": 8, "Sweeper Keeper": 7,
    "Regista": 6, "Inverted Full-Back": 6, "Deep Playmaker": 5,
    "Anchor": 4,
  },
  big_game_player: {
    "Complete Forward": 7, "Prima Punta": 6, "Poacher": 6,
    "Stopper": 5, "Box-to-Box": 5, "Inside Forward": 5,
    "Regista": 4, "Advanced Playmaker": 4,
  },
  inconsistent: {
    "Anchor": -8, "Stopper": -6, "Sweeper": -6, "Ball-Playing CB": -5,
    "Regista": -5, "Deep Playmaker": -5, "Shot Stopper": -5,
    "Trequartista": -2, // mercurial players tolerated here
  },
  clutch: {
    "Poacher": 8, "Inside Forward": 6, "Complete Forward": 6,
    "Seconda Punta": 5, "Prima Punta": 5, "Box-to-Box": 4,
  },
  hot_headed: {
    "Ball-Winner": -2, // tolerated for destroyers
    "Anchor": -8, "Regista": -6, "Ball-Playing CB": -5,
    "Sweeper": -5, "Deep Playmaker": -5,
    "Stopper": 2, // controlled aggression can help
  },
  quiet_leader: {
    "Sweeper": 7, "Ball-Playing CB": 6, "Anchor": 6, "Regista": 5,
    "Deep Playmaker": 5, "Complete Forward": 4, "Sweeper Keeper": 4,
  },
  long_throws: {
    "Overlapping Full-Back": 5, "Wing-Back": 4,
  },
};

/**
 * Compute trait profile score for a player against their best role.
 * Returns 0-100 based on how well their traits align with the role.
 */
export function computeTraitProfileScore(
  traits: Array<{ trait: string; severity: number }>,
  roleName: string,
): number {
  if (traits.length === 0) return 50; // no data

  let totalImpact = 0;
  let maxPossibleImpact = 0;

  for (const { trait, severity } of traits) {
    const roleImpacts = TRAIT_ROLE_IMPACT[trait];
    if (!roleImpacts) continue;

    const impact = roleImpacts[roleName] ?? 0;
    // Severity scales the impact: severity 1-10, impact -10 to +10
    totalImpact += impact * (severity / 10);
    maxPossibleImpact += Math.abs(impact) * (severity / 10);
  }

  if (maxPossibleImpact === 0) return 50;

  // Normalize: -1 to +1 → 0 to 100
  const normalized = totalImpact / maxPossibleImpact;
  return Math.round(50 + normalized * 50);
}
