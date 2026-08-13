import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client, talked to DIRECTLY (never proxied through `apps/aaos-api`) — the
 * one deliberate exception to this app's "proxy everything to aaos-api" architecture (coordinator
 * note #1). Used for both Supabase Auth (`lib/auth.ts`) and Supabase Realtime (`lib/realtime.ts`).
 * Uses `@supabase/ssr`'s `createBrowserClient` (not the plain `@supabase/supabase-js`
 * `createClient`) so the session is persisted in cookies rather than `localStorage` — the same
 * storage `middleware.ts` reads server-side via `createServerClient`, so a session set in the
 * browser is visible to the Edge middleware on the very next request.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url === undefined || url.length === 0) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (anonKey === undefined || anonKey.length === 0) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  }
  return createBrowserClient(url, anonKey);
}
