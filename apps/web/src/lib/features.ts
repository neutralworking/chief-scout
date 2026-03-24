/**
 * Feature flags — gates features behind tier-based access.
 *
 * Free users see games + discovery (Gaffer, On The Plane, Free Agents, Legends, News).
 * Scout users see full player intelligence (profiles, archetypes, comparisons).
 * Pro users get operational tools (shortlists, squad builder, scout pad, export, API).
 *
 * Flags are derived from fc_users.tier and read from AuthProvider context.
 */

import { TIER_LIMITS, type Tier } from "./stripe";

export interface FeatureFlags {
  /** Full player profiles (radar, personality, attributes, career) */
  fullProfiles: boolean;
  /** Player search with filters */
  playerSearch: boolean;
  /** Archetype classification system */
  showArchetypes: boolean;
  /** Personality MBTI-style profiling */
  showPersonality: boolean;
  /** Attribute grades and radar chart */
  showAttributes: boolean;
  /** Radar visualization */
  showRadar: boolean;
  /** Side-by-side player comparison */
  comparison: boolean;
  /** Formation player mapping */
  formations: boolean;
  /** Club squad depth analysis */
  clubDepth: boolean;
  /** Deep news intelligence (player-tagged, sentiment) */
  newsIntel: boolean;
  /** Market value tiers, scarcity, premium */
  marketIntel: boolean;
  /** Pursuit pipeline, shortlists, position depth gap analysis */
  shortlists: boolean;
  /** Squad builder with needs assessment */
  squadBuilder: boolean;
  /** Scout pad working notepad */
  scoutPad: boolean;
  /** Network / Gems discovery */
  network: boolean;
  /** CSV export */
  csvExport: boolean;
  /** REST API access */
  apiAccess: boolean;
  /** Predicted scorelines + W/D/L probabilities (free for all) */
  predictedScores: boolean;
  /** Deep match analysis: xG, pillar comparison, key player impact (scout+) */
  deepMatchAnalysis: boolean;
}

const DEFAULTS: FeatureFlags = {
  fullProfiles: false,
  playerSearch: false,
  showArchetypes: false,
  showPersonality: false,
  showAttributes: false,
  showRadar: false,
  comparison: false,
  formations: false,
  clubDepth: false,
  newsIntel: false,
  marketIntel: false,
  shortlists: false,
  squadBuilder: false,
  scoutPad: false,
  network: false,
  csvExport: false,
  apiAccess: false,
  predictedScores: true,
  deepMatchAnalysis: false,
};

/**
 * Derive feature flags from a user tier.
 */
export function getFeaturesForTier(tier: Tier): FeatureFlags {
  const limits = TIER_LIMITS[tier];
  return {
    fullProfiles: limits.fullProfiles,
    playerSearch: limits.playerSearch,
    showArchetypes: limits.showArchetypes,
    showPersonality: limits.showPersonality,
    showAttributes: limits.showAttributes,
    showRadar: limits.showRadar,
    comparison: limits.comparison,
    formations: limits.formations,
    clubDepth: limits.clubDepth,
    newsIntel: limits.newsIntel,
    marketIntel: limits.marketIntel,
    shortlists: limits.shortlists,
    squadBuilder: limits.squadBuilder,
    scoutPad: limits.scoutPad,
    network: limits.network,
    csvExport: limits.csvExport,
    apiAccess: limits.apiAccess,
    predictedScores: limits.predictedScores,
    deepMatchAnalysis: limits.deepMatchAnalysis,
  };
}

/**
 * Extract feature flags from user preferences object (legacy support).
 * Falls back to defaults for any missing keys.
 */
export function getFeatureFlags(
  preferences: Record<string, unknown> | null | undefined
): FeatureFlags {
  if (!preferences) return { ...DEFAULTS };

  return {
    fullProfiles: Boolean(preferences.fullProfiles ?? DEFAULTS.fullProfiles),
    playerSearch: Boolean(preferences.playerSearch ?? DEFAULTS.playerSearch),
    showArchetypes: Boolean(preferences.showArchetypes ?? DEFAULTS.showArchetypes),
    showPersonality: Boolean(preferences.showPersonality ?? DEFAULTS.showPersonality),
    showAttributes: Boolean(preferences.showAttributes ?? DEFAULTS.showAttributes),
    showRadar: Boolean(preferences.showRadar ?? DEFAULTS.showRadar),
    comparison: Boolean(preferences.comparison ?? DEFAULTS.comparison),
    formations: Boolean(preferences.formations ?? DEFAULTS.formations),
    clubDepth: Boolean(preferences.clubDepth ?? DEFAULTS.clubDepth),
    newsIntel: Boolean(preferences.newsIntel ?? DEFAULTS.newsIntel),
    marketIntel: Boolean(preferences.marketIntel ?? DEFAULTS.marketIntel),
    shortlists: Boolean(preferences.shortlists ?? DEFAULTS.shortlists),
    squadBuilder: Boolean(preferences.squadBuilder ?? DEFAULTS.squadBuilder),
    scoutPad: Boolean(preferences.scoutPad ?? DEFAULTS.scoutPad),
    network: Boolean(preferences.network ?? DEFAULTS.network),
    csvExport: Boolean(preferences.csvExport ?? DEFAULTS.csvExport),
    apiAccess: Boolean(preferences.apiAccess ?? DEFAULTS.apiAccess),
    predictedScores: Boolean(preferences.predictedScores ?? DEFAULTS.predictedScores),
    deepMatchAnalysis: Boolean(preferences.deepMatchAnalysis ?? DEFAULTS.deepMatchAnalysis),
  };
}

/**
 * Check a single feature flag from preferences.
 */
export function hasFeature(
  preferences: Record<string, unknown> | null | undefined,
  flag: keyof FeatureFlags
): boolean {
  return getFeatureFlags(preferences)[flag];
}
