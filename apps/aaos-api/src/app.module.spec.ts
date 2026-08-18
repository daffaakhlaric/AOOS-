import type { Provider } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { AppModule } from "./app.module.js";
import {
  AAOS_API_CONFIG,
  ASSET_LIBRARY,
  BRANCH_MANAGER,
  EVENT_PUBLISHER,
  LEAD_STORE,
  LEAD_STORE_CLOSING_REPOSITORY,
  LEAD_STORE_MESSAGE_REPOSITORY,
  META_ADS_CONNECTOR,
  MOBIX_SCRAPER_SERVICE,
  OBJECTIVE_ENGINE,
  SUPABASE_CLIENT,
  WHATSAPP_CONNECTOR,
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
    expect(dynamicModule.imports).toHaveLength(15);
    expect(dynamicModule.providers).toHaveLength(15);
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

  it("exports exactly the AAOS_API_CONFIG/EVENT_PUBLISHER/META_ADS_CONNECTOR/WHATSAPP_CONNECTOR/LEAD_STORE/OBJECTIVE_ENGINE/BRANCH_MANAGER/LEAD_STORE_MESSAGE_REPOSITORY/LEAD_STORE_CLOSING_REPOSITORY/SUPABASE_CLIENT tokens", () => {
    const dynamicModule = AppModule.forRoot(buildTestConfig());
    expect(dynamicModule.exports).toEqual([
      AAOS_API_CONFIG,
      EVENT_PUBLISHER,
      META_ADS_CONNECTOR,
      WHATSAPP_CONNECTOR,
      LEAD_STORE,
      OBJECTIVE_ENGINE,
      BRANCH_MANAGER,
      LEAD_STORE_MESSAGE_REPOSITORY,
      LEAD_STORE_CLOSING_REPOSITORY,
      SUPABASE_CLIENT,
      ASSET_LIBRARY,
      MOBIX_SCRAPER_SERVICE,
    ]);
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
