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

/** `KieWebhookController`'s real, mounted route — kept as one named constant so this file (which builds the outbound `callBackUrl`) and `KieWebhookModule`'s `@Controller` decorator (the inbound route it actually serves) can never silently drift apart. */
export const KIE_WEBHOOK_PATH = "/api/v1/creative-packages/webhooks/kie";

/**
 * PROMPT 53 — KIE WEBHOOK (Phase 41). Builds the real `callBackUrl` this app hands Kie AI on every
 * generation request — `${AAOS_API_BASE_URL}${KIE_WEBHOOK_PATH}?secret=${KIE_WEBHOOK_SECRET}` —
 * ONLY when both `AAOS_API_BASE_URL` and `KIE_WEBHOOK_SECRET` are genuinely configured (both are
 * deliberately allowed to be empty strings — see their own `AaosApiConfig` doc comments — so a
 * deployment that hasn't set them up yet just never gets a `callbackUrl` at all, and Kie AI is
 * never told about an endpoint this deployment can't actually authenticate against). The secret is
 * a QUERY PARAMETER, not a header, because Kie AI's real callback (confirmed directly against this
 * codebase's own `KieApiResponseMapper`/`KieAiGenerationClient` — no HMAC/signature scheme
 * anywhere) has no documented way for this app to ask it to send a custom header back; a query
 * param on the URL Kie AI is simply told to POST to is the one mechanism guaranteed to round-trip.
 *
 * `undefined` (the pre-existing, unconfigured-today behavior — see this file's own git history:
 * `callbackUrl` was never populated before this phase) when either half is missing — the real Kie
 * AI generation requests then carry no `callBackUrl` at all, exactly as before, and completion is
 * detected purely by `TaskPoller`'s existing, unaffected polling loop.
 */
function buildCallbackUrl(config: AaosApiConfig): string | undefined {
  if (config.AAOS_API_BASE_URL.length === 0 || config.KIE_WEBHOOK_SECRET.length === 0) {
    return undefined;
  }
  const baseUrl = config.AAOS_API_BASE_URL.replace(/\/+$/, "");
  return `${baseUrl}${KIE_WEBHOOK_PATH}?secret=${encodeURIComponent(config.KIE_WEBHOOK_SECRET)}`;
}

/**
 * Translates this app's `AaosApiConfig` into `@aos/creative-connector`'s own
 * `CreativeConnectorConfig`, going through the package's real Zod validation (same pattern as
 * `to-asset-library-config.ts`/`to-lead-store-config.ts`) rather than an unchecked cast.
 *
 * Every other non-key field is left to the package's own defaults, which are the REAL production
 * values: `generationBaseUrl: "https://api.kie.ai"`, `uploadBaseUrl: "https://kieai.redpandaai.co"`,
 * `defaultVideoModel: "veo3_fast"`, `defaultImageModel: "nano-banana-pro"` (no `google/` prefix —
 * confirmed live against `api.kie.ai`; see `ImageModel`'s docstring). No model string is
 * re-declared here — duplicating them would let this file drift from the connector's own enums.
 *
 * PROMPT 53 — KIE WEBHOOK (Phase 41) additionally wires a real `callbackUrl` — see
 * `buildCallbackUrl`'s own doc for exactly when it is/isn't populated.
 */
export function toCreativeConnectorConfig(
  config: AaosApiConfig,
): Result<CreativeConnectorConfig, CreativeConnectorError> {
  const callbackUrl = buildCallbackUrl(config);
  return parseCreativeConnectorConfig({
    apiKey: config.KIE_AI_API_KEY,
    tenantId: config.AAOS_TENANT_ID,
    ...(callbackUrl !== undefined ? { callbackUrl } : {}),
  });
}
