import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase-middleware";
import { isRouteAllowed, isProduction } from "@/lib/env";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Block staging-only routes in production (redirect to home)
  if (isProduction() && !isRouteAllowed(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Block all admin API routes in production (return 404)
  if (isProduction() && pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    // Run on all routes except static files and images
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
