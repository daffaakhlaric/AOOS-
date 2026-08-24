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
    // AAOS-LLM-TAMARA: +1 import (LlmModule) — no new global provider (LlmModule composes its
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
    // AAOS-TAMARA-INTELLIGENCE-LAYER Phase 4: +1 import (IntelligenceModule) — no new global
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
    expect(dynamicModule.imports).toHaveLength(27);
    expect(dynamicModule.providers).toHaveLength(23);
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

  it("exports exactly the AAOS_API_CONFIG/EVENT_PUBLISHER/EVENT_BROKER/META_ADS_CONNECTOR/META_ADS_CONNECTOR_REGISTRY/WHATSAPP_CONNECTOR/WHATSAPP_CONNECTOR_REGISTRY/LEAD_STORE/OBJECTIVE_ENGINE/BRANCH_MANAGER/LEAD_STORE_MESSAGE_REPOSITORY/LEAD_STORE_CLOSING_REPOSITORY/LEAD_STORE_SCORING_REPOSITORY/LEAD_STORE_LEAD_REPOSITORY/SUPABASE_CLIENT/SUPABASE_AUTH_ADMIN/CAPI_CONNECTOR tokens", () => {
    const dynamicModule = AppModule.forRoot(buildTestConfig());
    expect(dynamicModule.exports).toEqual([
      AAOS_API_CONFIG,
      EVENT_PUBLISHER,
      EVENT_BROKER,
      META_ADS_CONNECTOR,
      META_ADS_CONNECTOR_REGISTRY,
      WHATSAPP_CONNECTOR,
      WHATSAPP_CONNECTOR_REGISTRY,
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
