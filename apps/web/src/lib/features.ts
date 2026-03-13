/**
 * Feature flags — gates pro features behind user preferences.
 *
 * Consumer users see a discovery-oriented dashboard.
 * Pro users (shortlists enabled) see the pursuit pipeline panel.
 *
 * Flags are stored in fc_users.preferences jsonb and read
 * from the AuthProvider context or from server-side profile fetch.
 */

export interface FeatureFlags {
  /** Enables pursuit pipeline, shortlists, position depth gap analysis */
  shortlists: boolean;
}

const DEFAULTS: FeatureFlags = {
  shortlists: false,
};

/**
 * Extract feature flags from a user preferences object.
 * Falls back to defaults for any missing keys.
 */
export function getFeatureFlags(
  preferences: Record<string, unknown> | null | undefined
): FeatureFlags {
  if (!preferences) return { ...DEFAULTS };

  return {
    shortlists: Boolean(preferences.shortlists ?? DEFAULTS.shortlists),
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
