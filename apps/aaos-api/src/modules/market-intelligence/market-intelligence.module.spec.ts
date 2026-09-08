import "reflect-metadata";

import { GoogleTrendsService } from "@aos/meta-ads-agent";
import { describe, expect, it } from "vitest";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { CompetitorPageRepository } from "../intelligence/infrastructure/competitor-page.repository.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import { MarketSignalsRepository } from "./infrastructure/market-signals.repository.js";
import { MarketIntelligenceController } from "./market-intelligence.controller.js";
import { MarketIntelligenceModule } from "./market-intelligence.module.js";
import { MarketIntelligenceService } from "./market-intelligence.service.js";

type FactoryProvider = {
  provide?: unknown;
  useFactory?: (...args: never[]) => unknown;
  inject?: unknown[];
};

describe("MarketIntelligenceModule", () => {
  it("registers MarketIntelligenceController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", MarketIntelligenceModule) as unknown[];
    expect(metadata).toEqual([MarketIntelligenceController]);
  });

  it("registers MarketIntelligenceService and ApiKeyGuard as class providers", () => {
    const metadata = Reflect.getMetadata("providers", MarketIntelligenceModule) as unknown[];
    expect(metadata).toContain(MarketIntelligenceService);
    expect(metadata).toContain(ApiKeyGuard);
  });

  it("exports MarketIntelligenceService so SchedulerModule/IntelligenceModule can inject it", () => {
    const metadata = Reflect.getMetadata("exports", MarketIntelligenceModule) as unknown[];
    expect(metadata).toEqual([MarketIntelligenceService]);
  });

  it.each([
    ["TenantRepository", TenantRepository],
    ["CompetitorPageRepository", CompetitorPageRepository],
    ["MarketSignalsRepository", MarketSignalsRepository],
  ])("provides %s from the SHARED SUPABASE_CLIENT (not a second connection)", (_name, klass) => {
    const metadata = Reflect.getMetadata(
      "providers",
      MarketIntelligenceModule,
    ) as FactoryProvider[];
    const provider = metadata.find((p) => p.provide === klass);
    expect(provider).toBeDefined();
    expect(provider?.inject).toEqual([SUPABASE_CLIENT]);
    const fakeClient = { from: () => undefined, channel: () => undefined } as never;
    expect(provider?.useFactory?.(fakeClient)).toBeInstanceOf(
      klass as new (...args: never[]) => unknown,
    );
  });

  it("provides real GoogleTrendsService via a no-arg useFactory", () => {
    const metadata = Reflect.getMetadata(
      "providers",
      MarketIntelligenceModule,
    ) as FactoryProvider[];
    const provider = metadata.find((p) => p.provide === GoogleTrendsService);
    expect(provider).toBeDefined();
    expect(provider?.useFactory?.()).toBeInstanceOf(GoogleTrendsService);
  });
});
