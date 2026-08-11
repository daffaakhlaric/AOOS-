import type { Result } from "@aos/common";
import type { LeadStoreConfig, LeadStoreError } from "@aos/lead-store";
import { parseLeadStoreConfig } from "@aos/lead-store";

import type { AaosApiConfig } from "./aaos-api.config.js";

/**
 * Translates this app's `AaosApiConfig` (flat env-var shape) into `@aos/lead-store`'s own
 * `LeadStoreConfig`, going through `parseLeadStoreConfig`'s real Zod validation (same pattern as
 * `to-connector-config.ts`/`to-whatsapp-connector-config.ts`) rather than an unchecked cast.
 */
export function toLeadStoreConfig(config: AaosApiConfig): Result<LeadStoreConfig, LeadStoreError> {
  return parseLeadStoreConfig({
    supabaseUrl: config.SUPABASE_URL,
    supabaseAnonKey: config.SUPABASE_ANON_KEY,
    supabaseServiceKey: config.SUPABASE_SERVICE_KEY,
    tenantId: config.AAOS_TENANT_ID,
    realtimeEnabled: true,
  });
}
