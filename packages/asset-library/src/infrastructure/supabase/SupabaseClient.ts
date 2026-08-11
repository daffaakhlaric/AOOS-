import { createClient } from "@supabase/supabase-js";

import type { AssetLibraryConfig } from "../../config/AssetLibraryConfig.js";

import type { SupabaseStorageClientLike } from "./SupabaseStorageTypes.js";
import type { SupabaseClientLike } from "./SupabaseTypes.js";

/**
 * Factory for the real Supabase client, bridged to this package's minimal `SupabaseClientLike`
 * (Postgrest `assets` table) and `SupabaseStorageClientLike` (Storage bucket) ports at this single
 * composition boundary (see each type file's docstring for why). The real `@supabase/supabase-js`
 * `SupabaseClient`'s `.from(...)`/`.storage.from(...)` methods are structurally compatible with
 * these ports for every operation this package performs; the casts below are `unknown`-mediated
 * (never `any`) and confined to this one file, mirroring `@aos/lead-store`'s `SupabaseClient.ts`.
 */
export function createSupabaseClient(config: AssetLibraryConfig): SupabaseClientLike {
  const client = createClient(config.supabaseUrl, config.supabaseServiceKey);
  return client as unknown as SupabaseClientLike;
}

export function createSupabaseStorageClient(config: AssetLibraryConfig): SupabaseStorageClientLike {
  const client = createClient(config.supabaseUrl, config.supabaseServiceKey);
  return client.storage as unknown as SupabaseStorageClientLike;
}
