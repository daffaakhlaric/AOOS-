import { createClient } from "@supabase/supabase-js";

import type { SupabaseClientLike } from "./SupabaseTypes.js";

/**
 * Factory for the real Supabase client, bridged to this package's minimal `SupabaseClientLike`
 * (Postgrest `scraped_units` table) port at this single composition boundary — see the type file's
 * docstring for why the port exists. The real `@supabase/supabase-js` `SupabaseClient`'s `.from(…)`
 * method is structurally compatible with this port for every operation this package performs; the
 * cast below is `unknown`-mediated (never `any`) and confined to this one file, mirroring
 * `@aos/asset-library`'s and `@aos/lead-store`'s own `SupabaseClient.ts`.
 *
 * Callers pass the SAME `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` every other AAOS package uses — one
 * Supabase project, a new table, not a second project.
 */
export function createSupabaseClient(url: string, serviceKey: string): SupabaseClientLike {
  const client = createClient(url, serviceKey);
  return client as unknown as SupabaseClientLike;
}
