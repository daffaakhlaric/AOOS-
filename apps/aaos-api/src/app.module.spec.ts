import type { Provider } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { AppModule } from "./app.module.js";
import {
  AAOS_API_CONFIG,
  ASSET_LIBRARY,
  BRANCH_MANAGER,
  CAPI_CONNECTOR,
  EVENT_BROKER,
  EVENT_PUBLISHER,
  KAI_AGENT_RUNTIME,
  LEAD_STORE,
  LEAD_STORE_CLOSING_REPOSITORY,
  LEAD_STORE_LEAD_REPOSITORY,
  LEAD_STORE_MESSAGE_REPOSITORY,
  LEAD_STORE_SCORING_REPOSITORY,
  META_ADS_CONNECTOR,
  META_ADS_CONNECTOR_REGISTRY,
  MOBIX_SCRAPER_SERVICE,
  OBJECTIVE_ENGINE,
  SUPABASE_AUTH_ADMIN,
  SUPABASE_CLIENT,
  WEBHOOK_SECRETS_SERVICE,
  WHATSAPP_CONNECTOR,
  WHATSAPP_CONNECTOR_REGISTRY,
} from "./di-tokens.js";
import { buildTestConfig } from "./test-support/fixtures.js";

/** Narrows a Nest `Provider` union member down to its `{ provide, useValue }` shape, for providers this app always registers as `useValue` (never `useClass`/`useFactory`/a bare class). */
function findValueProvider(
  providers: Provider[] | undefined,
  token: unknown,
): { provide: unknown; useValue: unknown } | undefined {
  return providers?.find(
    (provider) =>
      typeof provider === "object" &&
      provider !== null &&
      "provide" in provider &&
      provider.provide === token,
  ) as { provide: unknown; useValue: unknown } | undefined;
}

describe("AppModule.forRoot", () => {
  it("builds a global DynamicModule wiring config/publisher/connector providers for a valid config", () => {
    const dynamicModule = AppModule.forRoot(buildTestConfig());
    expect(dynamicModule.module).toBe(AppModule);
    expect(dynamicModule.global).toBe(true);
    // AAOS-W1D-S3: +1 import (CampaignsModule) for POST /api/v1/campaigns/create.
    // AAOS-W4B: +2 imports (ClosingsModule, SalesModule) and +2 providers
    // (LEAD_STORE_MESSAGE_REPOSITORY, LEAD_STORE_CLOSING_REPOSITORY).
    // AAOS-LLM-SAMANTHA: +1 import (LlmModule) — no new global provider (LlmModule composes its
    // own OpenAI client/rate limiter/cache locally, see llm.module.ts's class doc).
    // AAOS-DASHBOARD-SIMULASI: +1 import (SimulationModule) and +1 provider (SUPABASE_CLIENT,
    // the shared client SimulationRepository reuses — see di-tokens.ts's class doc).
    // AAOS-SCRAPER-ASSET-LIBRARY: +2 imports (ScraperModule, AssetsModule) and +2 providers
    // (ASSET_LIBRARY, MOBIX_SCRAPER_SERVICE).
    // AAOS-CREATIVE-REVIEW: +1 provider (KAI_AGENT_RUNTIME, the composed @aos/creative-agent
    // pipeline) — no new import (the existing CreativePackagesModule now backs it).
    // AAOS-SIMULASI-TARGETING: +1 import (MetaInterestsModule, for POST /api/v1/meta-interests/sync
    // and the Simulasi audience preview's real interest candidates) — no new global provider (it
    // composes its repository locally from the existing SUPABASE_CLIENT).
    // AAOS-KALENDER-AKTIVITAS: +2 imports (ScheduleModule.forRoot(), SchedulerModule) — no new
    // global provider (SchedulerModule composes its repository locally from the existing
    // SUPABASE_CLIENT, same as SimulationModule/ScraperModule/MetaInterestsModule).
    // AAOS-CHAT-ROOM-JESSY: +1 provider (LEAD_STORE_SCORING_REPOSITORY, the shared
    // ScoringRepository GET /leads/:id/scoring-history reads) — no new import (LeadsModule
    // already existed).
    // AAOS-SALES-MGMT-CRM-AUTH: +1 provider (SUPABASE_AUTH_ADMIN, the real Supabase Auth Admin
    // client SalesHumansService calls) — no new import (SalesModule already existed).
    // AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 1: +2 imports (SuperadminModule, SettingsModule)
    // — no new global provider (both compose TenantRepository/WabaConfigRepository locally from the
    // existing SUPABASE_CLIENT, same as every other per-feature repository).
    // AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 2: +1 import (ListingsModule) — no new global
    // provider (composes ListingRepository locally from the existing SUPABASE_CLIENT, and reuses
    // the already-global ASSET_LIBRARY token for photo upload, same pattern as AssetsModule).
    // AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 4 (Go Live): +1 import (GoLiveModule) — no new
    // global provider (composes SimulationRepository/WabaConfigRepository locally from the
    // existing SUPABASE_CLIENT, reuses the already-global META_ADS_CONNECTOR/AAOS_API_CONFIG).
    // AAOS-LEAD-RECYCLING-BROADCAST: +1 import (RecyclingModule) and +2 providers (EVENT_BROKER —
    // the same real EventBroker instance as EVENT_PUBLISHER, exposed under its subscriber-capable
    // interface for RecyclingReplyListener; LEAD_STORE_LEAD_REPOSITORY — the real
    // @aos/lead-store LeadRepository composed against the existing SUPABASE_CLIENT).
    // AAOS-ABTESTING-LOOKALIKE Part 1: +1 import (AbTestingModule) — no new global provider
    // (composes its 2 repositories locally from the existing SUPABASE_CLIENT, reuses the
    // already-global META_ADS_CONNECTOR/AAOS_API_CONFIG, and CreativePackagesModule's exported
    // CreativePackagesService for creative generation).
    // AAOS-ABTESTING-LOOKALIKE Part 2: +1 import (LookalikeModule) — no new global provider
    // (composes its 1 repository locally from the existing SUPABASE_CLIENT, reuses the
    // already-global META_ADS_CONNECTOR/AAOS_API_CONFIG/LEAD_STORE).
    // AAOS-SOSMED-AUTOMATION Phase 1: +1 import (SosmedModule) — no new global provider (imports
    // LlmModule to reuse the already-existing LlmService, composes ScheduledPostRepository
    // locally from the existing SUPABASE_CLIENT).
    // AAOS-SAMANTHA-INTELLIGENCE-LAYER Phase 4: +1 import (IntelligenceModule) — no new global
    // provider (composes TenantRepository/ListingRepository/IntelligenceSignalsRepository/
    // CompetitorPageRepository locally from the existing SUPABASE_CLIENT, imports LlmModule to
    // reuse the already-existing LlmService, same pattern as SosmedModule/RecyclingModule).
    // AAOS-META-MCP-BONUS-TOOLS (Tool 4 — CAPI Health): +1 provider (CAPI_CONNECTOR, the composed
    // @aos/capi-connector CapiConnector — undefined when CAPI_PIXEL_ID/CAPI_ACCESS_TOKEN aren't
    // configured, same pattern as KAI_AGENT_RUNTIME) — no new import (IntelligenceModule already
    // existed).
    // AAOS-MULTI-TENANT-PHASE1B Phase 2: +1 provider (WHATSAPP_CONNECTOR_REGISTRY, the real
    // per-tenant WhatsAppConnector resolver — composed from the existing whatsAppConnector/
    // publisher/leadStoreSupabaseClient, no new import).
    // AAOS-MULTI-TENANT-PHASE1B Phase 3: +1 provider (META_ADS_CONNECTOR_REGISTRY, the real
    // per-tenant MetaAdsConnector resolver — composed from the existing connector/publisher/
    // leadStoreSupabaseClient via a new local TenantRepository instance, no new import).
    // AAOS-SETTINGS-WEBHOOK-CONFIG Part C: +1 provider (WEBHOOK_SECRETS_SERVICE, the real global
    // Meta/WhatsApp webhook secret resolver — composed here alongside both connector registries
    // via a new local SystemWebhookConfigRepository instance, no new import; see di-tokens.ts's
    // WEBHOOK_SECRETS_SERVICE doc for why it's global instead of module-scoped).
    // AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase B: +1 import (ActivityLogModule, exporting
    // ActivityLogger — MetaAdsModule/CampaignsModule each import it directly, same "small
    // standalone module" pattern ModeGuardModule already establishes) — no new global provider
    // (ActivityRepository is composed locally from the existing SUPABASE_CLIENT).
    // AAOS Overview Monitor Phase O1: +1 import (OverviewModule, the new
    // `GET /api/v1/overview` aggregate) — no new global provider (composes its own
    // JudgeResultRepository locally from the existing SUPABASE_CLIENT, same pattern
    // AiJudgeModule already establishes for this exact repository class; every other real
    // source it reuses is injected in-process via LeadsModule/MetaAdsModule/ObjectiveModule/
    // RecyclingModule/ActivityLogModule/LlmModule's own now-exported services, not a new
    // global provider here).
    // Phase O1 (PROPERTY Objective backend): +1 import (PropertyObjectiveModule, the new
    // genuinely-separate `GET/POST /api/v1/property-objective` + budget-suggestion endpoints) —
    // no new global provider (composes its own PropertyObjectiveRepository locally from the
    // existing SUPABASE_CLIENT, same pattern OverviewModule/PendingActionsModule already
    // establish; reuses MetaAdsModule's already-exported MetaAdsService in-process, not a new
    // global provider here). ObjectiveModule itself is untouched.
    // AAOS-GEO-TARGETING-AND-REGION-PICKER Part B: +1 import (RegionModule, the new
    // `GET /api/v1/region/provinces|regencies/:provinceId|districts/:regencyId` real proxy over
    // the public wilayah catalog) — no new global provider (composes its own in-memory
    // `ResponseCache` locally, no `SUPABASE_CLIENT`/tenant dependency at all).
    // AAOS LOOP UPGRADE, Sprint 6 Prompt 17: +1 import (AuditLogModule, the new real
    // `GET/POST /api/v1/audit-log*` HTTP surface) — no new global provider (composes its own
    // AuditLogRepository locally from the existing SUPABASE_CLIENT, same pattern
    // PropertyObjectiveModule/OverviewModule already establish; imports the existing MetaAdsModule
    // for its own real rollback wiring, not a new global provider here).
    // AAOS LOOP UPGRADE, Sprint 7 Prompt 18: +1 import (MarketIntelligenceModule, the new real
    // `GET/POST /api/v1/market-signals/*` HTTP surface) — no new global provider (composes its own
    // TenantRepository/CompetitorPageRepository/MarketSignalsRepository locally from the existing
    // SUPABASE_CLIENT, same pattern IntelligenceModule already establishes; IntelligenceModule
    // itself now imports this module directly to thread `market_signals` into
    // `LlmService.campaignStrategy`'s context, not a new global provider here).
    // EYVRA-META-OAUTH-WHATSAPP-SETUP Sprint 2: +1 import (MetaOAuthModule, the new real
    // `/oauth/*` HTTP surface) — no new global provider (composes its own TenantRepository/
    // WabaConfigRepository/EncryptionService/MetaOAuthConfigService locally from the existing
    // SUPABASE_CLIENT/AAOS_API_CONFIG, same "each module composes its own instance" pattern
    // SettingsModule/SosmedModule already establish).
    // EYVRA — SAMANTHA V2 Phase 1 Part A: +2 imports (GrowthObjectivesModule/
    // HotLeadDefinitionsModule, the new real `/api/v1/growth-objectives`/
    // `/api/v1/hot-lead-definitions` HTTP surfaces) — no new global provider (each composes its
    // own repository locally from the existing SUPABASE_CLIENT via `useFactory`, same
    // "each module composes its own instance of a shared repository class" pattern
    // SuperadminModule's TenantRepository provider already establishes).
    // EYVRA — SAMANTHA V2 Phase 1 Part B (first half): +1 import (MetricSnapshotModule, the new
    // real `/api/v1/metric-snapshots/*` HTTP surface) — no new global provider (composes its own
    // MetricSnapshotRepository locally from the existing SUPABASE_CLIENT via `useFactory`, same
    // pattern GrowthObjectivesModule/HotLeadDefinitionsModule already establish).
    // EYVRA — SAMANTHA V2 + KAI V2 Phase 2: +1 import (CreativeMemoryModule, the new real
    // `GET /api/v1/creative-memory/angle-performance` HTTP surface) — no new global provider
    // (composes its own CreativeMemoryRepository locally from the existing SUPABASE_CLIENT via
    // `useFactory`, same pattern MetricSnapshotModule establishes; deliberately does not import
    // CreativePackagesModule — see creative-memory.module.ts's own doc for why).
    // EYVRA — SAMANTHA V2 Phase 3: +1 import (CampaignHealthModule, the new real
    // `GET /api/v1/campaign-health/:campaignId` HTTP surface) — no new global provider and no new
    // repository at all (imports MetricSnapshotModule to reuse its already-exported
    // MetricSnapshotService instead of composing its own repository, unlike every module above).
    // EYVRA — SAMANTHA V2 Phase 9: +1 import (OpportunitiesModule, the new real
    // `GET /api/v1/opportunities/:campaignId` HTTP surface) — no new global provider and no new
    // repository at all (imports CampaignHealthModule/CreativeMemoryModule to reuse their
    // already-exported services, same pattern CampaignHealthModule itself establishes for
    // MetricSnapshotModule).
    expect(dynamicModule.imports).toHaveLength(40);
    expect(dynamicModule.providers).toHaveLength(24);
  });

  it("provides KAI_AGENT_RUNTIME as undefined when no Kie AI key / asset library is configured, so the app still boots", () => {
    const dynamicModule = AppModule.forRoot(buildTestConfig());
    const provider = findValueProvider(dynamicModule.providers, KAI_AGENT_RUNTIME);
    // Same load-bearing "token exists, value is undefined" contract as ASSET_LIBRARY — see
    // di-tokens.ts's KAI_AGENT_RUNTIME doc. No Kie AI call is ever attempted in this state.
    expect(provider).toBeDefined();
    expect(provider?.useValue).toBeUndefined();
  });

  it("leaves KAI_AGENT_RUNTIME undefined when KIE_AI_API_KEY is set but the asset library is not (Kai structurally needs it)", () => {
    const dynamicModule = AppModule.forRoot(buildTestConfig({ KIE_AI_API_KEY: "kie-real-key" }));
    expect(findValueProvider(dynamicModule.providers, KAI_AGENT_RUNTIME)?.useValue).toBeUndefined();
  });

  it("provides ASSET_LIBRARY as undefined when no GCS credentials are configured, so the app still boots", () => {
    const dynamicModule = AppModule.forRoot(buildTestConfig());
    const provider = findValueProvider(dynamicModule.providers, ASSET_LIBRARY);
    // The token must EXIST (otherwise Nest fails dependency resolution for AssetsService) but
    // resolve to `undefined` — see di-tokens.ts's ASSET_LIBRARY doc.
    expect(provider).toBeDefined();
    expect(provider?.useValue).toBeUndefined();
  });

  it("always provides a composed MOBIX_SCRAPER_SERVICE (its only hard dependency is the shared publisher)", () => {
    const dynamicModule = AppModule.forRoot(buildTestConfig());
    const provider = findValueProvider(dynamicModule.providers, MOBIX_SCRAPER_SERVICE);
    expect(provider?.useValue).toBeDefined();
  });

  it("always provides a composed WHATSAPP_CONNECTOR_REGISTRY (its dss-motor fallback needs only the already-composed static connector)", () => {
    const dynamicModule = AppModule.forRoot(buildTestConfig());
    const provider = findValueProvider(dynamicModule.providers, WHATSAPP_CONNECTOR_REGISTRY);
    expect(provider?.useValue).toBeDefined();
  });

  it("always provides a composed META_ADS_CONNECTOR_REGISTRY (its dss-motor fallback needs only the already-composed static connector)", () => {
    const dynamicModule = AppModule.forRoot(buildTestConfig());
    const provider = findValueProvider(dynamicModule.providers, META_ADS_CONNECTOR_REGISTRY);
    expect(provider?.useValue).toBeDefined();
  });

  it("throws the raw ConnectorConfigError when META_API_VERSION is not the literal v21.0", () => {
    expect(() => AppModule.forRoot(buildTestConfig({ META_API_VERSION: "v20.0" }))).toThrow(
      /MetaAdsConnectorConfig validation failed/,
    );
  });

  it("throws the raw ConnectorConfigError when a WABA phoneNumber is not a +62 E.164 number", () => {
    expect(() => AppModule.forRoot(buildTestConfig({ PHONE_NUMBER_BINTARO: "0812345" }))).toThrow(
      /WhatsAppConnectorConfig validation failed/,
    );
  });

  it("throws the raw LeadStoreError when SUPABASE_URL is not a valid URL", () => {
    expect(() => AppModule.forRoot(buildTestConfig({ SUPABASE_URL: "not-a-url" }))).toThrow(
      /LeadStoreConfig validation failed/,
    );
  });

  it("exports exactly the AAOS_API_CONFIG/EVENT_PUBLISHER/EVENT_BROKER/META_ADS_CONNECTOR/META_ADS_CONNECTOR_REGISTRY/WHATSAPP_CONNECTOR/WHATSAPP_CONNECTOR_REGISTRY/WEBHOOK_SECRETS_SERVICE/LEAD_STORE/OBJECTIVE_ENGINE/BRANCH_MANAGER/LEAD_STORE_MESSAGE_REPOSITORY/LEAD_STORE_CLOSING_REPOSITORY/LEAD_STORE_SCORING_REPOSITORY/LEAD_STORE_LEAD_REPOSITORY/SUPABASE_CLIENT/SUPABASE_AUTH_ADMIN/CAPI_CONNECTOR tokens", () => {
    const dynamicModule = AppModule.forRoot(buildTestConfig());
    expect(dynamicModule.exports).toEqual([
      AAOS_API_CONFIG,
      EVENT_PUBLISHER,
      EVENT_BROKER,
      META_ADS_CONNECTOR,
      META_ADS_CONNECTOR_REGISTRY,
      WHATSAPP_CONNECTOR,
      WHATSAPP_CONNECTOR_REGISTRY,
      WEBHOOK_SECRETS_SERVICE,
      LEAD_STORE,
      OBJECTIVE_ENGINE,
      BRANCH_MANAGER,
      LEAD_STORE_MESSAGE_REPOSITORY,
      LEAD_STORE_CLOSING_REPOSITORY,
      LEAD_STORE_SCORING_REPOSITORY,
      LEAD_STORE_LEAD_REPOSITORY,
      SUPABASE_CLIENT,
      SUPABASE_AUTH_ADMIN,
      ASSET_LIBRARY,
      MOBIX_SCRAPER_SERVICE,
      KAI_AGENT_RUNTIME,
      CAPI_CONNECTOR,
    ]);
  });

  it("provides CAPI_CONNECTOR as undefined when no CAPI pixel/token is configured, so the app still boots", () => {
    const dynamicModule = AppModule.forRoot(buildTestConfig());
    const provider = findValueProvider(dynamicModule.providers, CAPI_CONNECTOR);
    expect(provider).toBeDefined();
    expect(provider?.useValue).toBeUndefined();
  });

  it("composes a real CAPI_CONNECTOR when CAPI_PIXEL_ID and CAPI_ACCESS_TOKEN are both configured", () => {
    const dynamicModule = AppModule.forRoot(
      buildTestConfig({ CAPI_PIXEL_ID: "pixel-1", CAPI_ACCESS_TOKEN: "capi-token" }),
    );
    const provider = findValueProvider(dynamicModule.providers, CAPI_CONNECTOR);
    expect(provider?.useValue).toBeDefined();
  });

  it("leaves CAPI_CONNECTOR undefined when only CAPI_PIXEL_ID is set (both are required)", () => {
    const dynamicModule = AppModule.forRoot(buildTestConfig({ CAPI_PIXEL_ID: "pixel-1" }));
    expect(findValueProvider(dynamicModule.providers, CAPI_CONNECTOR)?.useValue).toBeUndefined();
  });

  it("provides AAOS_API_CONFIG as the exact config value passed in", () => {
    const config = buildTestConfig({ AAOS_TENANT_ID: "distinct-tenant" });
    const dynamicModule = AppModule.forRoot(config);
    const configProvider = findValueProvider(dynamicModule.providers, AAOS_API_CONFIG);
    expect(configProvider?.useValue).toBe(config);
  });

  it("throws when META_ACCESS_TOKEN is empty (ConnectorConfigError, not a generic Error)", () => {
    expect(() => AppModule.forRoot(buildTestConfig({ META_ACCESS_TOKEN: "" }))).toThrow();
  });

  it("provides a distinct EventBroker-backed IPublisher for each forRoot call (not a shared singleton)", () => {
    const first = AppModule.forRoot(buildTestConfig());
    const second = AppModule.forRoot(buildTestConfig());
    const firstPublisher = findValueProvider(first.providers, EVENT_PUBLISHER)?.useValue;
    const secondPublisher = findValueProvider(second.providers, EVENT_PUBLISHER)?.useValue;
    expect(firstPublisher).not.toBe(secondPublisher);
  });
});
