import type { Result } from "@aos/common";
import type { CreativeConnectorConfig, CreativeConnectorError } from "@aos/creative-connector";
import { parseCreativeConnectorConfig } from "@aos/creative-connector";

import type { AaosApiConfig } from "./aaos-api.config.js";

/**
 * True when this deployment can run the REAL Kai/Kie AI pipeline at all (AAOS-CREATIVE-REVIEW).
 *
 * Both conditions are load-bearing, not defensive: `@aos/creative-connector` cannot call Kie AI
 * without an API key, and `KaiAgentFactory` structurally requires `@aos/asset-library`'s
 * `GetAssetsByUnit` (source photos) and `SaveAiCreative` (where generated media is persisted),
 * which only exist when the GCS-backed asset library was composed.
 */
export function isCreativePipelineConfigured(
  config: AaosApiConfig,
  assetLibraryConfigured: boolean,
): boolean {
  return config.KIE_AI_API_KEY.length > 0 && assetLibraryConfigured;
}

/**
 * Translates this app's `AaosApiConfig` into `@aos/creative-connector`'s own
 * `CreativeConnectorConfig`, going through the package's real Zod validation (same pattern as
 * `to-asset-library-config.ts`/`to-lead-store-config.ts`) rather than an unchecked cast.
 *
 * Every non-key field is left to the package's own defaults, which are the REAL production values:
 * `generationBaseUrl: "https://api.kie.ai"`, `uploadBaseUrl: "https://kieai.redpandaai.co"`,
 * `defaultVideoModel: "veo3_fast"`, `defaultImageModel: "nano-banana-pro"` (no `google/` prefix —
 * confirmed live against `api.kie.ai`; see `ImageModel`'s docstring). No model string is
 * re-declared here — duplicating them would let this file drift from the connector's own enums.
 */
export function toCreativeConnectorConfig(
  config: AaosApiConfig,
): Result<CreativeConnectorConfig, CreativeConnectorError> {
  return parseCreativeConnectorConfig({
    apiKey: config.KIE_AI_API_KEY,
    tenantId: config.AAOS_TENANT_ID,
  });
}
