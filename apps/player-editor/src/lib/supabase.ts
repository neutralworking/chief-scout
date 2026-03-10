import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-side Supabase client (service role, bypasses RLS)
// Lazy — only created when called, so build doesn't fail without env vars
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables"
    );
  }

  return createClient(url, key);
}
