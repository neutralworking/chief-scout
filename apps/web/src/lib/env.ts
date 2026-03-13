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
const STAGING_ONLY_ROUTES = ["/admin", "/editor", "/scout-pad", "/squad"];

/** Check if a route is allowed in the current environment */
export function isRouteAllowed(pathname: string): boolean {
  if (isStaging()) return true; // staging shows everything
  return !STAGING_ONLY_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );
}
