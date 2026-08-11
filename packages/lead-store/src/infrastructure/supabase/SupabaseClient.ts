import { createClient } from "@supabase/supabase-js";

import type { LeadStoreConfig } from "../../config/LeadStoreConfig.js";

import type { SupabaseClientLike } from "./SupabaseTypes.js";

/**
 * Factory for the real Supabase client, bridged to this package's minimal `SupabaseClientLike`
 * port at this single composition boundary (see `SupabaseTypes.ts`'s docstring for why). The real
 * `@supabase/supabase-js` `SupabaseClient`'s `.from(...)`/`.channel(...)` methods are structurally
 * compatible with `SupabaseClientLike` for every operation this package performs; the cast below
 * is `unknown`-mediated (never `any`) and confined to this one file.
 */
export function createSupabaseClient(
  config: LeadStoreConfig,
  useServiceKey = true,
): SupabaseClientLike {
  const key = useServiceKey ? config.supabaseServiceKey : config.supabaseAnonKey;
  const client = createClient(config.supabaseUrl, key);
  return client as unknown as SupabaseClientLike;
}
