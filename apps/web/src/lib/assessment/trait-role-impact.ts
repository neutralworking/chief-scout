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
    "Regista": 10, "Libero": 8, "Metodista": 8, "Enganche": 6,
    "Invertido": 7, "Mezzala": 5, "Falso Nove": 7, "Trequartista": 6,
    "Sweeper Keeper": 6, "Libero GK": 6,
  },
  flamboyant: {
    "Trequartista": 8, "Inside Forward": 5, "Inventor": 5, "Falso Nove": 4,
    "False Winger": 4, "Shuttler": 3,
    "Sentinelle": -5, "Stopper": -4, "Volante": -3,
  },
  direct: {
    "Shuttler": 8, "Extremo": 7, "Inside Forward": 6, "Spearhead": 5,
    "Poacher": 4, "Seconda Punta": 5, "Counter Attack Threat": 6,
    "Regista": -3, "Metodista": -3, "Falso Nove": -2,
  },
  patient: {
    "Regista": 7, "Metodista": 7, "Libero": 5, "Enganche": 6,
    "Sentinelle": 5, "Pivote": 5, "Invertido": 5, "Controller": 6,
    "Shuttler": -4, "Spearhead": -3,
  },
  elegant: {
    "Trequartista": 7, "Regista": 6, "Falso Nove": 5, "Enganche": 5,
    "False Winger": 5, "Inventor": 5, "Libero": 4,
    "Stopper": -3, "Volante": -2,
  },
  aerial_threat: {
    "Prima Punta": 10, "Stopper": 7, "Poacher": 5, "Libero": 3,
    "Sweeper": 3,
    "Falso Nove": -2, "Regista": -1,
  },
  endurance: {
    "Tuttocampista": 8, "Engine": 8, "Fluidificante": 8, "Spearhead": 7,
    "Volante": 6, "Lateral": 6, "Corredor": 8, "Tornante": 8, "Mezzala": 5,
    "Extremo": 4, "Shuttler": 4,
  },
  progressive_carrier: {
    "Libero": 10, "Mezzala": 8, "Invertido": 7, "Tuttocampista": 6,
    "False Winger": 5, "Inside Forward": 5, "Shuttler": 4,
    "Sentinelle": -3, "Pivote": -3, "Poacher": -2,
  },
  set_piece_specialist: {
    "Wide Provider": 8, "Enganche": 6, "Metodista": 5,
    "Prima Punta": 5, "Poacher": 3,
  },
  positional_discipline: {
    "Sentinelle": 10, "Pivote": 10, "Sweeper": 8, "Stopper": 7, "Cover": 7,
    "Libero": 6, "Invertido": 6, "Shotstopper": 5, "Comandante": 5,
    "Trequartista": -4, "Raumdeuter": -3,
  },
  high_press: {
    "Spearhead": 10, "Volante": 8, "Seconda Punta": 6,
    "Shuttler": 5, "Poacher": 5, "Engine": 5,
    "Mezzala": 4, "Extremo": 4, "Boxcrasher": 6, "Raumdeuter": 5,
    "Regista": -3, "Sweeper": -2,
  },
  counter_attack_threat: {
    "Extremo": 8, "Inside Forward": 7, "Shuttler": 7,
    "Seconda Punta": 6, "Boxcrasher": 6, "Poacher": 5, "Lateral": 4,
  },
  build_up_contributor: {
    "Libero": 8, "Libero GK": 7, "Sweeper Keeper": 7,
    "Regista": 6, "Invertido": 6, "Metodista": 5,
    "Sentinelle": 4, "Pivote": 4,
  },
  big_game_player: {
    "Poacher": 7, "Prima Punta": 6,
    "Stopper": 5, "Tuttocampista": 5, "Inside Forward": 5,
    "Regista": 4, "Enganche": 4,
  },
  inconsistent: {
    "Sentinelle": -8, "Pivote": -8, "Stopper": -6, "Sweeper": -6, "Libero": -5,
    "Regista": -5, "Metodista": -5, "Shotstopper": -5, "Comandante": -5,
    "Trequartista": -2, // mercurial players tolerated here
  },
  clutch: {
    "Poacher": 8, "Inside Forward": 6,
    "Seconda Punta": 5, "Boxcrasher": 5, "Prima Punta": 5, "Tuttocampista": 4,
  },
  hot_headed: {
    "Volante": -2, // tolerated for destroyers
    "Sentinelle": -8, "Pivote": -8, "Regista": -6, "Libero": -5,
    "Sweeper": -5, "Metodista": -5,
    "Stopper": 2, // controlled aggression can help
  },
  quiet_leader: {
    "Sweeper": 7, "Libero": 6, "Sentinelle": 6, "Pivote": 6, "Regista": 5,
    "Metodista": 5, "Poacher": 4, "Sweeper Keeper": 4, "Libero GK": 4,
    "Comandante": 5,
  },
  long_throws: {
    "Lateral": 5, "Fluidificante": 4, "Corredor": 4, "Tornante": 4,
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
