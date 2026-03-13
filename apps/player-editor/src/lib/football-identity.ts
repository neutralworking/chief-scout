/**
 * football-identity.ts — Map dimension scores → named footballing identity.
 *
 * Each of the 6 dimensions is 0-100 (50 = neutral).
 * The primary axis (furthest from 50) determines the archetype name.
 * A secondary modifier adds flavour.
 */

export interface IdentityDimensions {
  flair_vs_function: number;
  youth_vs_experience: number;
  attack_vs_defense: number;
  loyalty_vs_ambition: number;
  domestic_vs_global: number;
  stats_vs_eye_test: number;
  era_bias?: string;
}

interface IdentityArchetype {
  name: string;
  tagline: string;
  dimension: keyof Omit<IdentityDimensions, "era_bias">;
  direction: "high" | "low";
}

const ARCHETYPES: IdentityArchetype[] = [
  // High = flair side, Low = function side
  { name: "The Entertainer", tagline: "You'd rather lose 4-3 than win 1-0", dimension: "flair_vs_function", direction: "high" },
  { name: "The Pragmatist", tagline: "Results are the only aesthetic", dimension: "flair_vs_function", direction: "low" },
  // High = youth, Low = experience
  { name: "The Dream Builder", tagline: "Every academy kid could be the next Messi", dimension: "youth_vs_experience", direction: "high" },
  { name: "The Proven Hand", tagline: "You don't gamble with your starting XI", dimension: "youth_vs_experience", direction: "low" },
  // High = attack, Low = defense
  { name: "The Risk Taker", tagline: "Defence wins trophies, but goals win hearts", dimension: "attack_vs_defense", direction: "high" },
  { name: "The Guardian", tagline: "Clean sheets are beautiful", dimension: "attack_vs_defense", direction: "low" },
  // High = loyalty, Low = ambition
  { name: "The Romantic", tagline: "Football without loyalty is just business", dimension: "loyalty_vs_ambition", direction: "high" },
  { name: "The Empire Builder", tagline: "The best deserve the biggest stages", dimension: "loyalty_vs_ambition", direction: "low" },
  // High = stats, Low = eye test
  { name: "The Analyst", tagline: "If it can't be measured, it doesn't exist", dimension: "stats_vs_eye_test", direction: "high" },
  { name: "The Purist", tagline: "You know quality — no spreadsheet needed", dimension: "stats_vs_eye_test", direction: "low" },
  // High = domestic, Low = global
  { name: "The Patriot", tagline: "Your league, your players, your way", dimension: "domestic_vs_global", direction: "high" },
  { name: "The Globetrotter", tagline: "Talent has no passport", dimension: "domestic_vs_global", direction: "low" },
];

const MODIFIERS: Record<string, { high: string; low: string }> = {
  flair_vs_function: { high: "Creative", low: "Disciplined" },
  youth_vs_experience: { high: "Progressive", low: "Traditional" },
  attack_vs_defense: { high: "Attacking", low: "Defensive" },
  loyalty_vs_ambition: { high: "Romantic", low: "Ambitious" },
  domestic_vs_global: { high: "Local", low: "Global" },
  stats_vs_eye_test: { high: "Analytical", low: "Instinctive" },
};

export function computeIdentity(dims: IdentityDimensions): {
  name: string;
  tagline: string;
  modifier: string;
  primaryDimension: string;
  secondaryDimension: string;
} {
  const dimensions: (keyof Omit<IdentityDimensions, "era_bias">)[] = [
    "flair_vs_function", "youth_vs_experience", "attack_vs_defense",
    "loyalty_vs_ambition", "domestic_vs_global", "stats_vs_eye_test",
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

  return {
    name: archetype.name,
    tagline: archetype.tagline,
    modifier,
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
