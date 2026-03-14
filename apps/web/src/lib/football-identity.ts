/**
 * football-identity.ts — Map dimension scores → manager archetype + taste profile.
 *
 * Each of the 6 dimensions is 0-100 (50 = neutral).
 * The primary axis (furthest from 50) determines the manager archetype.
 * A secondary modifier adds flavour: "You manage like Wenger — with a moneyball streak"
 */

export interface IdentityDimensions {
  flair_vs_function: number;
  youth_vs_experience: number;
  attack_vs_defense: number;
  loyalty_vs_ambition: number;
  domestic_vs_global: number;
  stats_vs_eye_test: number;
  control_vs_chaos: number;
  era_bias?: string;
}

interface ManagerArchetype {
  name: string;
  tagline: string;
  dimension: keyof Omit<IdentityDimensions, "era_bias">;
  direction: "high" | "low";
}

const ARCHETYPES: ManagerArchetype[] = [
  // flair (high) vs function (low)
  { name: "The Guardiola", tagline: "The process IS the trophy", dimension: "flair_vs_function", direction: "high" },
  { name: "The Sacchi", tagline: "The system makes the player", dimension: "flair_vs_function", direction: "low" },
  // youth (high) vs experience (low)
  { name: "The Wenger", tagline: "You see potential where others see risk", dimension: "youth_vs_experience", direction: "high" },
  { name: "The Capello", tagline: "Experience is non-negotiable", dimension: "youth_vs_experience", direction: "low" },
  // attack (high) vs defense (low)
  { name: "The Bielsa", tagline: "Attack is a state of mind", dimension: "attack_vs_defense", direction: "high" },
  { name: "The Mourinho", tagline: "Results. Everything else is noise.", dimension: "attack_vs_defense", direction: "low" },
  // loyalty (high) vs ambition (low)
  { name: "The Ferguson", tagline: "You build dynasties, not squads", dimension: "loyalty_vs_ambition", direction: "high" },
  { name: "The Levy", tagline: "Every player has a price", dimension: "loyalty_vs_ambition", direction: "low" },
  // stats (high) vs eye test (low)
  { name: "The Beane", tagline: "The numbers don't lie", dimension: "stats_vs_eye_test", direction: "high" },
  { name: "The Clough", tagline: "You know a player when you see one", dimension: "stats_vs_eye_test", direction: "low" },
  // domestic (high) vs global (low)
  { name: "The Pulis", tagline: "You know your league inside out", dimension: "domestic_vs_global", direction: "high" },
  { name: "The Michels", tagline: "Football is universal", dimension: "domestic_vs_global", direction: "low" },
  // control (high) vs chaos (low)
  { name: "The Cruyff", tagline: "Possession is the purest form of attack", dimension: "control_vs_chaos", direction: "high" },
  { name: "The Simeone", tagline: "Let them have the ball — then strike", dimension: "control_vs_chaos", direction: "low" },
];

const MODIFIERS: Record<string, { high: string; low: string }> = {
  flair_vs_function: { high: "with a flair for the beautiful game", low: "who gets results" },
  youth_vs_experience: { high: "who backs youth", low: "who trusts experience" },
  attack_vs_defense: { high: "with an attacking instinct", low: "with a defensive edge" },
  loyalty_vs_ambition: { high: "with a romantic side", low: "with ruthless ambition" },
  domestic_vs_global: { high: "with local roots", low: "with a global eye" },
  stats_vs_eye_test: { high: "with a moneyball streak", low: "who trusts the eye test" },
  control_vs_chaos: { high: "who demands positional control", low: "who thrives in chaos" },
};

export function computeIdentity(dims: IdentityDimensions): {
  name: string;
  tagline: string;
  modifier: string;
  summary: string;
  primaryDimension: string;
  secondaryDimension: string;
} {
  const dimensions: (keyof Omit<IdentityDimensions, "era_bias">)[] = [
    "flair_vs_function", "youth_vs_experience", "attack_vs_defense",
    "loyalty_vs_ambition", "domestic_vs_global", "stats_vs_eye_test",
    "control_vs_chaos",
  ];

  // Sort by distance from neutral (50)
  const ranked = dimensions
    .map((d) => ({ dimension: d, value: dims[d] ?? 50, distance: Math.abs((dims[d] ?? 50) - 50) }))
    .sort((a, b) => b.distance - a.distance);

  const primary = ranked[0];
  const secondary = ranked[1];

  // Find matching archetype
  const direction = primary.value >= 50 ? "high" : "low";
  const archetype = ARCHETYPES.find(
    (a) => a.dimension === primary.dimension && a.direction === direction
  ) ?? ARCHETYPES[0];

  // Modifier from secondary axis
  const secDirection = secondary.value >= 50 ? "high" : "low";
  const modifier = MODIFIERS[secondary.dimension]?.[secDirection] ?? "";

  // Human-readable summary: "You manage like Wenger — who backs youth"
  const summary = `You manage like ${archetype.name.replace("The ", "")} — ${modifier}`;

  return {
    name: archetype.name,
    tagline: archetype.tagline,
    modifier,
    summary,
    primaryDimension: primary.dimension,
    secondaryDimension: secondary.dimension,
  };
}

/**
 * Apply dimension weights from a chosen option to the user's current scores.
 * Early votes shift more; later votes refine.
 */
export function applyDimensionWeights(
  currentDimensions: Partial<IdentityDimensions>,
  weights: Record<string, number>,
  totalVotes: number
): Partial<IdentityDimensions> {
  const dampening = Math.max(0.3, 1.0 - totalVotes * 0.02);
  const updated = { ...currentDimensions };

  for (const [key, weight] of Object.entries(weights)) {
    if (key === "era_bias") continue;
    const dimKey = key as keyof Omit<IdentityDimensions, "era_bias">;
    const current = updated[dimKey] ?? 50;
    const newVal = Math.round(Math.max(0, Math.min(100, current + weight * dampening)));
    updated[dimKey] = newVal;
  }

  return updated;
}
