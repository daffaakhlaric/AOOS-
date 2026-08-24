import type { CapiConnectorConfig, CapiError } from "@aos/capi-connector";
import { parseCapiConnectorConfig } from "@aos/capi-connector";
import type { Result } from "@aos/common";

import type { AaosApiConfig } from "./aaos-api.config.js";

/**
 * True when this deployment has enough config for `@aos/capi-connector`'s `CapiConnectorFactory`
 * to be composed at all (AAOS-META-MCP-BONUS-TOOLS, Tool 4 — CAPI Health).
 *
 * Checked BEFORE `toCapiConnectorConfig` in `app.module.ts`, same "skip composition entirely
 * rather than fail the whole app to boot" discipline as `isAssetLibraryConfigured`/
 * `isCreativePipelineConfigured` — an unconfigured deployment still serves every other endpoint,
 * and `IntelligenceService`'s CAPI-health signal degrades to an honest `available: false`.
 */
export function isCapiConnectorConfigured(config: AaosApiConfig): boolean {
  return config.CAPI_PIXEL_ID.length > 0 && config.CAPI_ACCESS_TOKEN.length > 0;
}

/**
 * Translates this app's `AaosApiConfig` (flat env-var shape) into `@aos/capi-connector`'s own
 * `CapiConnectorConfig`, going through `parseCapiConnectorConfig`'s real Zod validation (same
 * pattern as `to-asset-library-config.ts`/`to-whatsapp-connector-config.ts`) rather than an
 * unchecked cast. Every other `CapiConnectorConfig` field (`apiVersion`/`baseUrl`/`eventSourceUrl`/
 * `batchSize`/`flushIntervalMs`/`retryMaxAttempts`/`retryBaseDelayMs`) is left to
 * `CapiConnectorConfigSchema`'s own real defaults — this app has no reason to override Meta's
 * documented `v21.0`/`graph.facebook.com` defaults.
 */
export function toCapiConnectorConfig(
  config: AaosApiConfig,
): Result<CapiConnectorConfig, CapiError> {
  return parseCapiConnectorConfig({
    pixelId: config.CAPI_PIXEL_ID,
    accessToken: config.CAPI_ACCESS_TOKEN,
    tenantId: config.AAOS_TENANT_ID,
  });
}
