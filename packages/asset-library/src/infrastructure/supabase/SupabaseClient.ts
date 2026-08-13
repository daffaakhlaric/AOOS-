import { createClient } from "@supabase/supabase-js";

import type { AssetLibraryConfig } from "../../config/AssetLibraryConfig.js";

import type { SupabaseClientLike } from "./SupabaseTypes.js";

/**
 * Factory for the real Supabase client, bridged to this package's minimal `SupabaseClientLike`
 * (Postgrest `assets` table) port at this single composition boundary (see the type file's
 * docstring for why). The real `@supabase/supabase-js` `SupabaseClient`'s `.from(...)` method is
 * structurally compatible with this port for every operation this package performs; the cast
 * below is `unknown`-mediated (never `any`) and confined to this one file, mirroring
 * `@aos/lead-store`'s `SupabaseClient.ts`.
 *
 * METADATA PERSISTENCE ONLY (`AssetRepository`, the `assets` Postgrest table) — a completely
 * separate concern from file-byte storage, which is backed by GCS via `GcsStorageClient`
 * (`infrastructure/gcs/GcsStorageClient.ts`) since AAOS-W3E-S1. This function, and the
 * `supabaseUrl`/`supabaseServiceKey` config fields it consumes, are unaffected by that storage
 * swap.
 */
export function createSupabaseClient(config: AssetLibraryConfig): SupabaseClientLike {
  const client = createClient(config.supabaseUrl, config.supabaseServiceKey);
  return client as unknown as SupabaseClientLike;
}
