/**
 * Nest DI tokens for providers that are not classes (config value, event publisher instance,
 * the composed `@aos/meta-ads-connector` connector, and the raw `WebhookVerifier` used directly
 * by the GET handshake endpoint). Using distinct `Symbol`s (rather than string tokens) avoids any
 * accidental collision with a future provider that happens to share a string name.
 */
export const AAOS_API_CONFIG = Symbol("AAOS_API_CONFIG");
export const EVENT_PUBLISHER = Symbol("EVENT_PUBLISHER");
export const LEAD_STORE = Symbol("LEAD_STORE");
export const META_ADS_CONNECTOR = Symbol("META_ADS_CONNECTOR");
export const WEBHOOK_VERIFIER = Symbol("WEBHOOK_VERIFIER");
export const WHATSAPP_CONNECTOR = Symbol("WHATSAPP_CONNECTOR");
export const WHATSAPP_WEBHOOK_VERIFIER = Symbol("WHATSAPP_WEBHOOK_VERIFIER");
/** AAOS-W4A additions — see `app.module.ts`'s `forRoot` for how each is composed. */
export const OBJECTIVE_ENGINE = Symbol("OBJECTIVE_ENGINE");
export const BRANCH_MANAGER = Symbol("BRANCH_MANAGER");
/**
 * AAOS-CREATIVE-REVIEW — the composed `@aos/creative-agent` runtime (`KaiAgentFactory.create`),
 * the FIRST real wiring of the Kai/Kie AI generation pipeline into this app. Replaces the old
 * `CREATIVE_PACKAGE_STORE` token, whose process-local in-memory `Map` (2 fake seed packages, no
 * connection to any generation pipeline) is gone — package state is now durable Supabase rows.
 *
 * Provided as `KaiAgentRuntime | undefined`: the runtime needs BOTH a real Kie AI key
 * (`KIE_AI_API_KEY`) and a composed `ASSET_LIBRARY` (Kai reads source photos from it and writes
 * generated media back to it), so `app.module.ts` composes it only when both are configured and
 * provides `undefined` otherwise. Same graceful-degradation discipline as `ASSET_LIBRARY` — the
 * whole app still boots, and `CreativePackagesService` raises an honest 503 naming the missing env
 * vars rather than silently pretending a generation was queued.
 */
export const KAI_AGENT_RUNTIME = Symbol("KAI_AGENT_RUNTIME");
/**
 * AAOS-W4B additions — the raw `@aos/lead-store` `MessageRepository`/`ClosingRepository` infra
 * classes, composed in `app.module.ts` against the SAME Supabase client `LeadStoreFactory` uses
 * (shared, not a second connection). Needed because the composed `LeadStore` exposes no use case
 * for "list every message in a conversation" (lead-detail's real conversation history) or "list
 * raw closings matching a filter" (`GET /api/v1/closings`) — only `@aos/lead-store`'s aggregate
 * `GetClosingStats` and write-only `SaveMessage`. Both repository classes are genuinely exported
 * from `@aos/lead-store`'s public `index.ts`, so this composes only real, already-public symbols.
 */
export const LEAD_STORE_MESSAGE_REPOSITORY = Symbol("LEAD_STORE_MESSAGE_REPOSITORY");
export const LEAD_STORE_CLOSING_REPOSITORY = Symbol("LEAD_STORE_CLOSING_REPOSITORY");
/**
 * AAOS-CHAT-ROOM-JESSY addition — same rationale as `LEAD_STORE_MESSAGE_REPOSITORY` above: no
 * `LeadStore` use case exposes "list every scoring event for a lead" (`GET
 * /leads/:id/scoring-history`), only `@aos/lead-store`'s real, already-public `ScoringRepository`
 * infra class, composed here against the SAME Supabase client every other `lead-store`-backed
 * repository in this app shares.
 */
export const LEAD_STORE_SCORING_REPOSITORY = Symbol("LEAD_STORE_SCORING_REPOSITORY");
/**
 * AAOS-LLM-TAMARA additions — module-local providers for `modules/llm`, following
 * `LLM_*`'s own precedent (a process-local implementation detail of one module, not
 * a real external integration composed in `app.module.ts`, so these are provided inside
 * `LlmModule` itself, not exported from `AppModule.forRoot`).
 */
export const LLM_OPENAI_CLIENT = Symbol("LLM_OPENAI_CLIENT");
export const LLM_RATE_LIMITER = Symbol("LLM_RATE_LIMITER");
export const LLM_RESPONSE_CACHE = Symbol("LLM_RESPONSE_CACHE");
/**
 * AAOS-DASHBOARD-SIMULASI addition — the shared Supabase client `app.module.ts` already builds
 * for `@aos/lead-store` (same project/connection, new tables: `simulations`/`simulation_logs`),
 * exported so `SimulationModule`'s repository can reuse it instead of opening a second connection.
 */
export const SUPABASE_CLIENT = Symbol("SUPABASE_CLIENT");
/**
 * AAOS-SCRAPER-ASSET-LIBRARY additions — the first real `aaos-api` wiring of `@aos/asset-library`
 * and `@aos/mobix-web-scraper` (neither was composed anywhere in this app before).
 *
 * `ASSET_LIBRARY` is provided as `AssetLibrary | undefined`: `GcsStorageClient`'s constructor throws
 * when no GCS credentials are configured, so `app.module.ts` composes the library only when
 * `isAssetLibraryConfigured(config)` holds and provides `undefined` otherwise — letting the whole
 * app still boot and serve every other endpoint (same graceful-degradation discipline as
 * `OPENAI_API_KEY`/`AAOS_SIMULATOR_BASE_URL`). `AssetsService`/`ScraperService` surface that as an
 * honest 503-style error, never an empty asset list.
 *
 * `MOBIX_SCRAPER_SERVICE` is always provided (its only hard dependency is the shared `IPublisher`);
 * photo ingestion is wired only when `ASSET_LIBRARY` exists, and `scraped_units` persistence only
 * when Supabase is configured — both degrade per-feature inside the package itself.
 */
export const ASSET_LIBRARY = Symbol("ASSET_LIBRARY");
export const MOBIX_SCRAPER_SERVICE = Symbol("MOBIX_SCRAPER_SERVICE");
