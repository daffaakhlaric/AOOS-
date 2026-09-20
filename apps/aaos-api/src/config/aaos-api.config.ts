import { type Result } from "@aos/common";
import { parseConfig } from "@aos/config";
import type { ValidationError } from "@aos/errors";
import { z } from "zod";

/**
 * Per the spec's Configuration section (`docs/PROMPT-AAOS-W1B-AAOS-API.md`). `META_AD_ACCOUNT_IDS`
 * is documented there as a `string` (the raw env var is comma-separated, e.g. `"act_xxx,act_yyy"`)
 * but this module's own "Domain design guidance" explicitly asks for it to become an array after
 * parsing — so the *parsed* `AaosApiConfig` exposes `META_AD_ACCOUNT_IDS` as
 * `ReadonlyArray<string>`, not the raw string, since every consumer downstream (the
 * `MetaAdsConnectorConfig` translation in particular) needs the array form. The raw env var itself
 * is still a plain comma-separated string, matching `.env.example`.
 */
export interface AaosApiConfig {
  readonly PORT: number;
  readonly NODE_ENV: "development" | "production" | "test";
  readonly API_KEY: string;
  readonly META_API_VERSION: string;
  readonly META_ACCESS_TOKEN: string;
  readonly META_AD_ACCOUNT_IDS: ReadonlyArray<string>;
  readonly META_WEBHOOK_VERIFY_TOKEN: string;
  readonly META_WEBHOOK_APP_SECRET: string;
  readonly AAOS_TENANT_ID: string;

  // --- WhatsApp Cloud API (AAOS-W2A @aos/whatsapp-connector) ---
  readonly WHATSAPP_ACCESS_TOKEN: string;
  readonly WHATSAPP_WEBHOOK_VERIFY_TOKEN: string;
  readonly WHATSAPP_WEBHOOK_APP_SECRET: string;
  readonly WABA_ID_BINTARO: string;
  readonly PHONE_NUMBER_ID_BINTARO: string;
  readonly PHONE_NUMBER_BINTARO: string;
  readonly WABA_ID_CINERE: string;
  readonly PHONE_NUMBER_ID_CINERE: string;
  readonly PHONE_NUMBER_CINERE: string;
  // Judgment call (mirrors @aos/whatsapp-connector's own resolution — see that package's README
  // "Branch.PONDOK_BAMBU resolution"): these three env vars are named exactly as the spec lists
  // them, but `to-whatsapp-connector-config.ts` maps this WABA's `branch` field to `Branch.UMUM`,
  // since the real `Branch` enum has no `PONDOK_BAMBU` member.
  readonly WABA_ID_PONDOK_BAMBU: string;
  readonly PHONE_NUMBER_ID_PONDOK_BAMBU: string;
  readonly PHONE_NUMBER_PONDOK_BAMBU: string;
  readonly WABA_ID_BANDUNG: string;
  readonly PHONE_NUMBER_ID_BANDUNG: string;
  readonly PHONE_NUMBER_BANDUNG: string;

  // --- Supabase (AAOS-W2E @aos/lead-store) ---
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_KEY: string;

  /**
   * AAOS-LLM-SAMANTHA — OpenAI API key for the `llm` module's Samantha analysis/creative-brief/chat
   * endpoints. Deliberately allowed to be an empty string (not `min(1)`-required like every other
   * secret in this file): per the spec's Section 7 error handling, `LlmService` MUST treat a
   * missing/empty key as "AI unavailable" and degrade gracefully (never throw a config error at
   * startup) — this app should boot and serve every other endpoint with no OpenAI key configured
   * at all. See coordinator note #1 on `docs/PROMPT-AAOS-API-LLM-TAMARA.md`.
   */
  readonly OPENAI_API_KEY: string;

  /**
   * AAOS-DASHBOARD-SIMULASI — base URL of the real, already-deployed sibling app
   * `apps/aaos-simulator` (its `POST /api/simulate` runs Clara conversation simulations + AI
   * Judge scoring). Deliberately allowed to be an empty string, same rationale as
   * `OPENAI_API_KEY`: this app must boot and serve every other endpoint even when
   * `apps/aaos-simulator` isn't reachable from this environment yet. `SimulationService` treats an
   * empty value as "Clara/Judge stage unavailable" and records that honestly on the simulation
   * record instead of throwing or fabricating a result.
   */
  readonly AAOS_SIMULATOR_BASE_URL: string;

  /**
   * AAOS-SCRAPER-ASSET-LIBRARY — Google Cloud Storage settings for `@aos/asset-library`'s
   * `GcsStorageClient` (the `assets`/`scraper` modules' file-byte backend).
   *
   * Every one of these is deliberately allowed to be an empty string, exactly like
   * `OPENAI_API_KEY`/`AAOS_SIMULATOR_BASE_URL` above: `GcsStorageClient`'s constructor THROWS when
   * given neither credentials nor a key-file path, so requiring them here would make this whole app
   * fail to boot on a deployment that has no GCS configured yet. `app.module.ts` composes
   * `@aos/asset-library` only when `GCS_PROJECT_ID` plus one of
   * `GCS_CREDENTIALS`/`GCS_KEY_FILE_PATH` are present, and `AssetsService`/`ScraperService` report
   * "asset library not configured" honestly when it isn't — never a fabricated empty asset list.
   */
  readonly GCS_BUCKET_NAME: string;
  readonly GCS_PROJECT_ID: string;
  readonly GCS_CREDENTIALS: string;
  readonly GCS_KEY_FILE_PATH: string;

  /** AAOS-SCRAPER-ASSET-LIBRARY — mobixbydss.id listing URL the scraper fetches. Defaults to the real production listing. */
  readonly MOBIX_LISTING_URL: string;

  /**
   * AAOS-CREATIVE-REVIEW — Kie AI API key for `@aos/creative-connector` (real video/image
   * generation that costs real credits).
   *
   * Deliberately allowed to be an empty string, exactly like `OPENAI_API_KEY`/`GCS_*` above:
   * `app.module.ts` composes the Kai pipeline (`KaiAgentFactory`) only when this key AND the GCS
   * asset library are both configured, and `CreativePackagesService` reports "Kai not configured"
   * honestly (503) when it isn't — never a fabricated queued job. Every other endpoint still boots
   * and serves normally with no Kie AI key at all.
   */
  readonly KIE_AI_API_KEY: string;

  /**
   * PROMPT 53 — KIE WEBHOOK (Phase 41). A shared secret embedded as a query parameter on the
   * `callBackUrl` this app hands Kie AI (`to-creative-connector-config.ts`'s
   * `toCreativeConnectorConfig`), and checked back by `KieWebhookController`/`KieWebhookService` on
   * every inbound callback. This is the ONLY real authenticity check available: Kie AI's own real
   * API (confirmed directly against this codebase's `KieApiResponseMapper`/`KieAiGenerationClient`
   * — a plain `{code, msg, data}` JSON body, no HMAC/signature header anywhere) has no documented
   * signing scheme for its outbound callback, unlike Meta's `x-hub-signature-256` this app's
   * existing `webhooks/meta`/`whatsapp-webhook` endpoints verify. A shared-secret query param is
   * the standard, honest substitute when a provider doesn't sign its callbacks.
   *
   * Deliberately allowed to be an empty string, same graceful-degradation discipline as
   * `KIE_AI_API_KEY` above: `toCreativeConnectorConfig` only ever sets a real `callbackUrl` (i.e.
   * only ever turns the webhook path ON at all) when BOTH this AND `AAOS_API_BASE_URL` are
   * non-empty — see that file's own doc. Unset, Kie AI is never told about the webhook endpoint at
   * all, and this app relies purely on the pre-existing, unaffected `TaskPoller` polling loop, same
   * as before this phase.
   */
  readonly KIE_WEBHOOK_SECRET: string;

  /**
   * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY — base URL of the real, already-deployed
   * `apps/aaos-dashboard` app, used ONLY to build the `redirectTo` for
   * `supabase.auth.admin.generateLink({ type: 'magiclink', ... })`'s real impersonation flow
   * (`modules/superadmin`'s "Login as Tenant" — coordinator note section 1's chosen mechanism).
   * Deliberately allowed to be an empty string, same rationale as `AAOS_SIMULATOR_BASE_URL`: this
   * app must boot and serve every other endpoint even when the dashboard's own URL isn't known
   * yet. When empty, `generateLink` is called without `redirectTo`, and Supabase falls back to its
   * project's configured Site URL — impersonation still works, just via that default instead of an
   * explicit one.
   */
  readonly AAOS_DASHBOARD_BASE_URL: string;

  /**
   * AAOS-GO-LIVE (Phase 4) — the master safety switch for `POST /api/v1/simulation/:id/go-live`.
   * Defaults to `true` (dry run): every step logs `[DRY RUN] Would ...` to `simulation_logs`
   * without calling Meta/WhatsApp/CAPI. Per coordinator note section 6, this must NEVER silently
   * default to executing real mutations if unset — `AaosApiConfigSchema` below enforces that with
   * an explicit `.default(true)` on a boolean-coerced field, never `.default(false)`.
   */
  readonly GO_LIVE_DRY_RUN: boolean;
  /** Minimum `result.scoring.overallScore` a simulation must have to be eligible for Go Live. */
  readonly GO_LIVE_MIN_SCORE: number;
  /** How many hours after `live_at` a `POST /api/v1/simulation/:id/rollback` call is still accepted. */
  readonly ROLLBACK_WINDOW_HOURS: number;
  /**
   * The tenant's real Facebook Page id — required by Meta's `object_story_spec.page_id` for any ad
   * creative (`CreateAd`, new in this phase). Deliberately a single env var, NOT yet a per-tenant
   * `tenants` column: no page-id concept existed anywhere in this codebase before Go Live needed
   * one, and Phase 1's per-tenant `meta_access_token`/`meta_ad_account_id` precedent (coordinator
   * note section 4) is the natural home for it in a future pass, not invented here as an
   * unreviewed schema addition. Left allowed-empty like `KIE_AI_API_KEY`/`AAOS_SIMULATOR_BASE_URL`
   * above — `GoLiveService` raises an honest guard failure naming this var when it's needed
   * (status !== dry-run) and unset, rather than sending Meta a blank `page_id`.
   */
  readonly META_PAGE_ID: string;

  /**
   * AAOS-SOSMED-AUTOMATION Phase 4 — the Meta App's own `client_id`/`client_secret`, needed ONLY
   * for the real OAuth authorization-code exchange (`GET .../oauth/access_token`) this phase
   * introduces. Genuinely distinct from `META_ACCESS_TOKEN` (a long-lived system-user token typed
   * once into Settings, used for the Marketing API / `meta-ads-connector`) — no prior phase in this
   * codebase ever needed an App ID/Secret pair, since none of them perform a real user-facing OAuth
   * consent flow. Deliberately allowed to be an empty string, same graceful-degradation discipline
   * as `KIE_AI_API_KEY`/`OPENAI_API_KEY`: this app must still boot and serve every other endpoint
   * on a deployment where the Meta App isn't configured yet. `SosmedOAuthService`'s OAuth-start
   * endpoints raise an honest, explicit error naming the missing var rather than building a
   * malformed `authorizeUrl` or silently no-op-ing.
   */
  readonly META_APP_ID: string;
  readonly META_APP_SECRET: string;

  /**
   * AAOS-META-MCP-BONUS-TOOLS (Tool 4 — CAPI Health) — this tenant's real Meta Pixel id and a
   * real CAPI-scoped access token, the two required fields `@aos/capi-connector`'s
   * `CapiConnectorConfigSchema` needs beyond what `parseCapiConnectorConfig` already defaults.
   * Deliberately allowed to be an empty string, same graceful-degradation discipline as
   * `KIE_AI_API_KEY`/`META_APP_ID`: `app.module.ts` composes `CapiConnectorFactory` only when
   * BOTH are non-empty (`isCapiConnectorConfigured`), and `IntelligenceService`'s CAPI-health
   * signal reports an honest `available: false` when it isn't — never a fabricated score.
   */
  readonly CAPI_PIXEL_ID: string;
  readonly CAPI_ACCESS_TOKEN: string;

  /**
   * AAOS-SOSMED-AUTOMATION Phase 4 — this app's OWN public base URL, needed to build the
   * `redirect_uri` Meta calls back to after user consent (`.../oauth/official/callback`,
   * `.../oauth/sales/callback`). Distinct from `AAOS_DASHBOARD_BASE_URL` (the sibling
   * `apps/aaos-dashboard`'s URL) — the OAuth callback is an `aaos-api` HTTP endpoint, not a
   * dashboard page. Deliberately allowed to be an empty string, same rationale as
   * `AAOS_DASHBOARD_BASE_URL`: `SosmedOAuthService` raises an honest error naming this var when an
   * OAuth flow is started and it's unset, rather than sending Meta a malformed/empty `redirect_uri`.
   */
  readonly AAOS_API_BASE_URL: string;

  /**
   * AAOS-MARKET-INTELLIGENCE (Sprint 7 Prompt 18) — `kpr_rate.ts`'s real data source. Investigated
   * honestly: Bank Indonesia publishes the real BI 7-Day Reverse Repo Rate on its own website, but
   * this session found no real, stable, JSON/RSS-shaped public endpoint for it (BI's real
   * `bi.go.id` rate page is an HTML page meant for human reading, not a documented API — the same
   * "no official public REST API with a stable key-based auth flow" problem the coordinator note
   * flags for Google Trends, without even an unofficial-library workaround). Rather than scraping
   * an undocumented HTML page (fragile, and BI carries none of Google's tolerance for
   * high-volume automated scraping this session could verify), this is a MANUALLY-CURATED,
   * periodically-updated real rate value — the honest path the coordinator note's own point 4
   * explicitly sanctions ("a manually-curated, periodically-updated real rate value in a
   * config/table is the more honest approach for this phase, documented as such rather than
   * pretending a live feed exists when it doesn't"). Deliberately allowed to be an empty string:
   * `KprRateService` reports an honest `available: false` when unset, rather than fabricating a
   * rate — same graceful-degradation discipline as `META_APP_ID`/`KIE_AI_API_KEY` above. An
   * operator updates these 3 vars by hand after checking BI's real published rate (monthly cadence
   * is enough — see `KprRateService`'s own doc for why).
   */
  readonly MARKET_INTEL_KPR_RATE_PCT: string;
  readonly MARKET_INTEL_KPR_RATE_DIRECTION: "NAIK" | "TURUN" | "STABIL" | "";
  readonly MARKET_INTEL_KPR_RATE_AS_OF: string;

  /**
   * EYVRA-META-OAUTH-WHATSAPP-SETUP (Sprint 1 — Foundation) — the symmetric key
   * `common/encryption.service.ts`'s `EncryptionService` uses for AES-256-GCM encrypt/decrypt of
   * sensitive third-party tokens (a tenant's OAuth-obtained Meta access token, the global Meta
   * App's client secret). 64 hex characters = 32 raw bytes, `EncryptionService`'s own constructor
   * validates that length and throws when it's set but malformed. Deliberately allowed to be an
   * empty string here (NOT `.min(1, ...)`), same graceful-degradation discipline as
   * `KIE_AI_API_KEY`/`META_APP_ID` above: this app must still boot and run every test/every other
   * endpoint on a deployment (or in CI) where no encryption key has been provisioned yet — nothing
   * in this sprint's scope calls `EncryptionService.encrypt`/`.decrypt` from a real request path,
   * so there is nothing yet that NEEDS a configured key to boot. `EncryptionService.encrypt`/
   * `.decrypt` themselves throw an honest, explicit error naming this var when it's empty and a
   * caller actually tries to use them — never a silent no-op or a fabricated ciphertext.
   */
  readonly TOKEN_ENCRYPTION_KEY: string;

  /**
   * EYVRA-META-OAUTH-WHATSAPP-SETUP (Sprint 1 — Foundation) — the WhatsApp Embedded Signup
   * "Configuration ID" Meta issues per Meta App (distinct from `META_APP_ID`/`META_APP_SECRET`,
   * which identify the App itself). Stored here purely as this deployment's `.env` fallback for
   * `system_meta_oauth_config.wa_config_id` (same NULL-means-fall-back-to-env semantics
   * `WebhookSecretsService`/`system_webhook_config` already establish) — no real consumer reads
   * this yet in THIS sprint (the WhatsApp Embedded Signup flow itself is a later sprint), same
   * "allowed empty, wired in a later phase" discipline as `META_APP_ID` was when it first landed.
   */
  readonly WA_CONFIG_ID: string;
}

export const AaosApiConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  API_KEY: z.string().min(1, "API_KEY must not be empty"),
  META_API_VERSION: z.string().min(1, "META_API_VERSION must not be empty"),
  META_ACCESS_TOKEN: z.string().min(1, "META_ACCESS_TOKEN must not be empty"),
  META_AD_ACCOUNT_IDS: z
    .string()
    .min(1, "META_AD_ACCOUNT_IDS must not be empty")
    .transform((raw) =>
      raw
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    )
    .refine((ids) => ids.length > 0, "META_AD_ACCOUNT_IDS must contain at least one ad account id"),
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(1, "META_WEBHOOK_VERIFY_TOKEN must not be empty"),
  META_WEBHOOK_APP_SECRET: z.string().min(1, "META_WEBHOOK_APP_SECRET must not be empty"),
  AAOS_TENANT_ID: z.string().min(1, "AAOS_TENANT_ID must not be empty"),

  WHATSAPP_ACCESS_TOKEN: z.string().min(1, "WHATSAPP_ACCESS_TOKEN must not be empty"),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z
    .string()
    .min(1, "WHATSAPP_WEBHOOK_VERIFY_TOKEN must not be empty"),
  WHATSAPP_WEBHOOK_APP_SECRET: z.string().min(1, "WHATSAPP_WEBHOOK_APP_SECRET must not be empty"),
  WABA_ID_BINTARO: z.string().min(1, "WABA_ID_BINTARO must not be empty"),
  PHONE_NUMBER_ID_BINTARO: z.string().min(1, "PHONE_NUMBER_ID_BINTARO must not be empty"),
  PHONE_NUMBER_BINTARO: z.string().min(1, "PHONE_NUMBER_BINTARO must not be empty"),
  WABA_ID_CINERE: z.string().min(1, "WABA_ID_CINERE must not be empty"),
  PHONE_NUMBER_ID_CINERE: z.string().min(1, "PHONE_NUMBER_ID_CINERE must not be empty"),
  PHONE_NUMBER_CINERE: z.string().min(1, "PHONE_NUMBER_CINERE must not be empty"),
  WABA_ID_PONDOK_BAMBU: z.string().min(1, "WABA_ID_PONDOK_BAMBU must not be empty"),
  PHONE_NUMBER_ID_PONDOK_BAMBU: z.string().min(1, "PHONE_NUMBER_ID_PONDOK_BAMBU must not be empty"),
  PHONE_NUMBER_PONDOK_BAMBU: z.string().min(1, "PHONE_NUMBER_PONDOK_BAMBU must not be empty"),
  WABA_ID_BANDUNG: z.string().min(1, "WABA_ID_BANDUNG must not be empty"),
  PHONE_NUMBER_ID_BANDUNG: z.string().min(1, "PHONE_NUMBER_ID_BANDUNG must not be empty"),
  PHONE_NUMBER_BANDUNG: z.string().min(1, "PHONE_NUMBER_BANDUNG must not be empty"),

  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY must not be empty"),
  SUPABASE_SERVICE_KEY: z.string().min(1, "SUPABASE_SERVICE_KEY must not be empty"),

  // Intentionally NOT `.min(1, ...)` — an empty/unset OPENAI_API_KEY is a valid, expected runtime
  // state (see the `AaosApiConfig.OPENAI_API_KEY` doc comment above).
  OPENAI_API_KEY: z.string().default(""),

  // Intentionally NOT `.min(1, ...)`/`.url(...)` — see the `AaosApiConfig.AAOS_SIMULATOR_BASE_URL`
  // doc comment above.
  AAOS_SIMULATOR_BASE_URL: z.string().default(""),

  // AAOS-SCRAPER-ASSET-LIBRARY. All intentionally optional/defaulted — see the corresponding
  // `AaosApiConfig` doc comment for why requiring them would break boot on a GCS-less deployment.
  // `GCS_BUCKET_NAME` defaults to the same "aoos" bucket `AssetLibraryConfigSchema` itself defaults
  // to, so the two never disagree.
  GCS_BUCKET_NAME: z.string().default("aoos"),
  GCS_PROJECT_ID: z.string().default(""),
  GCS_CREDENTIALS: z.string().default(""),
  GCS_KEY_FILE_PATH: z.string().default(""),
  MOBIX_LISTING_URL: z.string().default("https://mobixbydss.id/produk"),

  // AAOS-CREATIVE-REVIEW. Intentionally NOT `.min(1, ...)` — see the `KIE_AI_API_KEY` doc comment.
  KIE_AI_API_KEY: z.string().default(""),

  // PROMPT 53 — KIE WEBHOOK (Phase 41). Intentionally NOT `.min(1, ...)` — see the
  // `AaosApiConfig.KIE_WEBHOOK_SECRET` doc comment.
  KIE_WEBHOOK_SECRET: z.string().default(""),

  // AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY. Intentionally NOT `.min(1, ...)`/`.url(...)` — see the
  // `AaosApiConfig.AAOS_DASHBOARD_BASE_URL` doc comment.
  AAOS_DASHBOARD_BASE_URL: z.string().default(""),

  // AAOS-GO-LIVE (Phase 4). `.default(true)` is load-bearing — see the `GO_LIVE_DRY_RUN` doc
  // comment above. `z.coerce.boolean()` would treat the STRING "false" as truthy (any non-empty
  // string coerces to `true`), so this instead accepts real env-var string forms explicitly.
  GO_LIVE_DRY_RUN: z
    .string()
    .default("true")
    .transform((raw) => raw.trim().toLowerCase() !== "false" && raw.trim() !== "0"),
  GO_LIVE_MIN_SCORE: z.coerce.number().int().min(0).max(100).default(60),
  ROLLBACK_WINDOW_HOURS: z.coerce.number().positive().default(1),
  META_PAGE_ID: z.string().default(""),

  // AAOS-SOSMED-AUTOMATION Phase 4. Intentionally NOT `.min(1, ...)` — see the `META_APP_ID`/
  // `META_APP_SECRET`/`AAOS_API_BASE_URL` doc comments above.
  META_APP_ID: z.string().default(""),
  META_APP_SECRET: z.string().default(""),
  AAOS_API_BASE_URL: z.string().default(""),

  // AAOS-META-MCP-BONUS-TOOLS (Tool 4). Intentionally NOT `.min(1, ...)` — see the
  // `AaosApiConfig.CAPI_PIXEL_ID`/`CAPI_ACCESS_TOKEN` doc comments above.
  CAPI_PIXEL_ID: z.string().default(""),
  CAPI_ACCESS_TOKEN: z.string().default(""),

  // AAOS-MARKET-INTELLIGENCE (Sprint 7 Prompt 18). Intentionally NOT `.min(1, ...)` — see the
  // `AaosApiConfig.MARKET_INTEL_KPR_RATE_PCT` doc comment above.
  MARKET_INTEL_KPR_RATE_PCT: z.string().default(""),
  MARKET_INTEL_KPR_RATE_DIRECTION: z.enum(["NAIK", "TURUN", "STABIL", ""]).default(""),
  MARKET_INTEL_KPR_RATE_AS_OF: z.string().default(""),

  // EYVRA-META-OAUTH-WHATSAPP-SETUP (Sprint 1). Intentionally NOT `.min(1, ...)`/`.length(64, ...)`
  // — see the `AaosApiConfig.TOKEN_ENCRYPTION_KEY` doc comment above. `EncryptionService`'s own
  // constructor is the real place that validates hex-length when this IS set.
  TOKEN_ENCRYPTION_KEY: z.string().default(""),
  WA_CONFIG_ID: z.string().default(""),
});

/**
 * Validates `process.env` (or an injected source, primarily for tests) against
 * `AaosApiConfigSchema`, per `@aos/config`'s `Result`-returning discipline (never throw for an
 * expected/recoverable failure). The *caller* — `main.ts`, one of the few places in the whole
 * AAOS stack where crashing at process-boundary startup is correct per this task's guidance —
 * decides to fail fast and exit the process on an `err` result.
 */
export function parseAaosApiConfig(
  source: Record<string, string | undefined> = process.env,
): Result<AaosApiConfig, ValidationError> {
  return parseConfig(AaosApiConfigSchema, source);
}
