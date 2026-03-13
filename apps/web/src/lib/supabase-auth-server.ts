import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Auth-aware server client — reads user session from cookies (RLS enforced)
// Use this in server components and route handlers that need the current user
export async function createSupabaseAuthServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll can fail in Server Components (read-only cookies)
            // This is fine — the middleware handles the refresh
          }
        },
      },
    }
  );
}
