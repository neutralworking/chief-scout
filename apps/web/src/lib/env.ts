/**
 * Environment detection — staging vs production.
 *
 * Set NEXT_PUBLIC_APP_ENV=production on the prod Vercel project.
 * Everything else defaults to staging.
 */

export type AppEnv = "staging" | "production";

export function getAppEnv(): AppEnv {
  return process.env.NEXT_PUBLIC_APP_ENV === "production"
    ? "production"
    : "staging";
}

export function isProduction(): boolean {
  return getAppEnv() === "production";
}

export function isStaging(): boolean {
  return getAppEnv() === "staging";
}

/** Routes that should only be visible on staging (internal tools) */
const STAGING_ONLY_ROUTES = ["/admin", "/editor", "/scout-pad", "/squad", "/formations", "/network"];

/** Check if a route is allowed in the current environment */
export function isRouteAllowed(pathname: string): boolean {
  if (isStaging()) return true; // staging shows everything
  return !STAGING_ONLY_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );
}

/**
 * Apply Tier 1 profile filter on production.
 * In staging, returns the query unchanged (all players visible).
 * Usage: `prodFilter(supabase.from("player_intelligence_card").select(...))`
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function prodFilter(query: any): any {
  if (isProduction()) {
    return query.eq("profile_tier", 1);
  }
  return query;
}
