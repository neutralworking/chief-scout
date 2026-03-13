import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/login", "/pricing", "/api", "/players", "/clubs", "/leagues", "/formations", "/news", "/free-agents", "/choices", "/admin", "/squad", "/rankings", "/scout-pad", "/_next", "/favicon.ico"];

/** Routes only available on staging — blocked in production */
const STAGING_ONLY_ROUTES = ["/admin", "/editor", "/scout-pad", "/squad"];

const isProd = process.env.NEXT_PUBLIC_APP_ENV === "production";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Block internal tools on production
  if (isProd && STAGING_ONLY_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Allow public paths through without auth check
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and images
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
