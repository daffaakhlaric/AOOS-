import type { Provider } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { AppModule } from "./app.module.js";
import {
  AAOS_API_CONFIG,
  EVENT_PUBLISHER,
  LEAD_STORE,
  META_ADS_CONNECTOR,
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
    expect(dynamicModule.imports).toHaveLength(5);
    expect(dynamicModule.providers).toHaveLength(8);
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

  it("exports exactly the AAOS_API_CONFIG/EVENT_PUBLISHER/META_ADS_CONNECTOR/WHATSAPP_CONNECTOR/LEAD_STORE tokens", () => {
    const dynamicModule = AppModule.forRoot(buildTestConfig());
    expect(dynamicModule.exports).toEqual([
      AAOS_API_CONFIG,
      EVENT_PUBLISHER,
      META_ADS_CONNECTOR,
      WHATSAPP_CONNECTOR,
      LEAD_STORE,
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
