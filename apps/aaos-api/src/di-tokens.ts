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
 * PROMPT 53 — KIE WEBHOOK (Phase 41). The SAME `ITaskWakeRegistry` instance
 * `CreativeConnectorFactory.create` composed `TaskPoller` with (`creativeConnector.taskWakeRegistry`
 * — see that factory's own doc), exposed as its own token so `KieWebhookService`
 * (`modules/creative-packages`) can inject it without reaching into `KAI_AGENT_RUNTIME`'s internals
 * (which does not expose it — `KaiAgentRuntime` has no concept of the underlying poller). Provided
 * as `ITaskWakeRegistry | undefined`, same graceful-degradation discipline as `KAI_AGENT_RUNTIME`
 * itself: `undefined` on any deployment where the Kai/Kie AI pipeline isn't composed at all, in
 * which case `KieWebhookService` honestly logs and drops any callback that somehow still reaches it
 * rather than crashing.
 */
export const TASK_WAKE_REGISTRY = Symbol("TASK_WAKE_REGISTRY");
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
 * AAOS-LLM-SAMANTHA additions — module-local providers for `modules/llm`, following
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
/**
 * AAOS-SALES-MGMT-CRM-AUTH addition — a real `@supabase/supabase-js` client constructed with the
 * SAME `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` as `SUPABASE_CLIENT`, but kept as a SEPARATE DI token
 * because it exposes `.auth.admin.*` (Supabase Auth's Admin API: `createUser`/`updateUserById`/
 * `listUsers`), which `SUPABASE_CLIENT`'s narrow `SupabaseClientLike` port (`@aos/lead-store`'s
 * `SupabaseTypes.ts` — deliberately only `.from(...)`/`.channel(...)`) does not and should not
 * declare. Same "one Supabase project, two typed views of the same stateless HTTP client" pattern
 * `app.module.ts`'s `ASSET_LIBRARY` client doc already establishes — not a second connection.
 * Used exclusively by `modules/sales`'s `SalesHumansService` to provision/update the real Supabase
 * Auth user backing a `sales_humans` row's `auth_user_id` (coordinator note #1 — never a custom
 * bcrypt/JWT auth system).
 */
export const SUPABASE_AUTH_ADMIN = Symbol("SUPABASE_AUTH_ADMIN");
/**
 * AAOS-LEAD-RECYCLING-BROADCAST additions.
 *
 * `LEAD_STORE_LEAD_REPOSITORY` — same rationale as `LEAD_STORE_MESSAGE_REPOSITORY`/
 * `LEAD_STORE_CLOSING_REPOSITORY` above: no `LeadStore` use case exposes "find a lead by phone +
 * branch" or "persist arbitrary broadcast fields on a lead" (the composed `LeadStore`'s own
 * `UpdateLeadStatus`/`RecordScoreEvent`/etc. each write only their own narrow slice), so
 * `RecyclingService`/`RecyclingReplyListener` are given the real, already-public
 * `@aos/lead-store` `LeadRepository` infra class directly, composed against the SAME Supabase
 * client every other `lead-store`-backed repository in this app shares.
 *
 * `EVENT_BROKER` — the SAME real `EventBroker` instance already composed as `EVENT_PUBLISHER`
 * (one event bus for the whole app), exposed under its full `IEventBroker` (publisher +
 * subscriber) interface rather than the narrower `IPublisher` `EVENT_PUBLISHER` uses. Needed
 * because `RecyclingReplyListener` (coordinator note section 9) is the FIRST real subscriber
 * anywhere in `aaos-api` to an event `@aos/whatsapp-connector` publishes — no prior module ever
 * called `.subscribe(...)`, only `.publish(...)`.
 */
export const LEAD_STORE_LEAD_REPOSITORY = Symbol("LEAD_STORE_LEAD_REPOSITORY");
export const EVENT_BROKER = Symbol("EVENT_BROKER");
/**
 * AAOS-META-MCP-BONUS-TOOLS (Tool 4 — CAPI Health) addition — the composed `@aos/capi-connector`
 * `CapiConnector` (`CapiConnectorFactory.create`), the first real wiring of that package into this
 * app (`GetEmqScore` had zero usage anywhere before this).
 *
 * Provided as `CapiConnector | undefined`: `app.module.ts` composes it only when
 * `isCapiConnectorConfigured(config)` holds (real `CAPI_PIXEL_ID`/`CAPI_ACCESS_TOKEN`), same
 * graceful-degradation discipline as `ASSET_LIBRARY`/`KAI_AGENT_RUNTIME` — the whole app still
 * boots, and `IntelligenceService`'s CAPI-health signal reports an honest `available: false`
 * rather than a fabricated score when it's `undefined`.
 *
 * Only `capiConnector.getEmqScore` is ever called by this app — `capiConnector.eventListenerService`
 * is composed (mirroring `CapiConnectorFactory`'s own all-or-nothing composition) but its
 * `.start()` is deliberately NEVER invoked here: that would begin subscribing to real
 * lead/closing domain events and sending live Lead/Purchase/Contact events to Meta's Conversions
 * API — a distinct, larger feature (real-time CAPI event forwarding) genuinely out of scope for
 * "Tool 4: CAPI Health", not something to silently switch on as a side effect of composing the
 * factory for its `getEmqScore` use case.
 */
export const CAPI_CONNECTOR = Symbol("CAPI_CONNECTOR");
/**
 * AAOS-MULTI-TENANT-PHASE1B (Phase 2) addition — the real per-tenant `WhatsAppConnectorRegistry`
 * (`modules/whatsapp/infrastructure/whatsapp-connector-registry.ts`), replacing `WHATSAPP_CONNECTOR`
 * as the injection point for every consumer that needs to send/process WhatsApp messages for a
 * SPECIFIC tenant rather than the one static, boot-composed connector. `WHATSAPP_CONNECTOR` itself
 * is kept, unchanged, as the registry's own real `dss-motor` fallback (see that class's doc) — not
 * removed, so this is an ADDITIVE token, not a replacement of an existing one.
 */
export const WHATSAPP_CONNECTOR_REGISTRY = Symbol("WHATSAPP_CONNECTOR_REGISTRY");
/**
 * AAOS-MULTI-TENANT-PHASE1B (Phase 3) addition — the real per-tenant `MetaAdsConnectorRegistry`
 * (`modules/meta-ads/infrastructure/meta-ads-connector-registry.ts`), replacing `META_ADS_CONNECTOR`
 * as the injection point for every consumer that needs to call Meta Ads for a SPECIFIC tenant
 * rather than the one static, boot-composed connector. `META_ADS_CONNECTOR` itself is kept,
 * unchanged, as the registry's own real `dss-motor` fallback (see that class's doc) — not
 * removed, so this is an ADDITIVE token, not a replacement of an existing one.
 */
export const META_ADS_CONNECTOR_REGISTRY = Symbol("META_ADS_CONNECTOR_REGISTRY");
/**
 * AAOS-SETTINGS-WEBHOOK-CONFIG (Part C) addition — the real, DB-first/`.env`-fallback resolver for
 * the GLOBAL Meta/WhatsApp webhook verify-token + app-secret pairs (`system_webhook_config`, one
 * row, superadmin-editable). Provided here (not inside a per-feature module) for the SAME reason
 * `META_ADS_CONNECTOR_REGISTRY`/`WHATSAPP_CONNECTOR_REGISTRY` are: both connector registries are
 * plain-constructed in `app.module.ts`'s `forRoot` (composition root, before Nest's DI container
 * exists), not managed by a dedicated Nest module, so this service is composed and shared the same
 * way — one instance, injected via this global token into `WebhookSignatureGuard`/
 * `WhatsAppSignatureGuard`/`WebhookService`/`WhatsAppWebhookService` (real Nest DI), and passed
 * directly into `MetaAdsConnectorRegistry`/`WhatsAppConnectorRegistry`'s constructors (plain JS,
 * composed alongside them in the same `forRoot` call) — never a second instance, so its in-memory
 * cache is genuinely global. This sidesteps the circular-import risk a `SuperadminModule`-hosted
 * service would have created for `WebhookModule`/`WhatsAppWebhookModule` (see
 * `docs/PROMPT-AAOS-SETTINGS-WEBHOOK-CONFIG.md` Part C item 3).
 */
export const WEBHOOK_SECRETS_SERVICE = Symbol("WEBHOOK_SECRETS_SERVICE");
export const CREATIVE_CONNECTOR_RUNTIME = Symbol("CREATIVE_CONNECTOR_RUNTIME");
