import "reflect-metadata";

import { GoogleTrendsService, SeasonalCalendarService } from "@aos/meta-ads-agent";
import { describe, expect, it } from "vitest";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ListingRepository } from "../listings/infrastructure/listing.repository.js";
import { LlmModule } from "../llm/llm.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import { CompetitorPageRepository } from "./infrastructure/competitor-page.repository.js";
import { IntelligenceSignalsRepository } from "./infrastructure/intelligence-signals.repository.js";
import { IntelligenceController } from "./intelligence.controller.js";
import { IntelligenceModule } from "./intelligence.module.js";
import { IntelligenceService } from "./intelligence.service.js";

type FactoryProvider = {
  provide?: unknown;
  useFactory?: (...args: never[]) => unknown;
  inject?: unknown[];
};

describe("IntelligenceModule", () => {
  it("registers IntelligenceController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", IntelligenceModule) as unknown[];
    expect(metadata).toEqual([IntelligenceController]);
  });

  it("imports LlmModule so IntelligenceService can inject the shared LlmService", () => {
    const metadata = Reflect.getMetadata("imports", IntelligenceModule) as unknown[];
    expect(metadata).toContain(LlmModule);
  });

  it("registers IntelligenceService and ApiKeyGuard as class providers", () => {
    const metadata = Reflect.getMetadata("providers", IntelligenceModule) as unknown[];
    expect(metadata).toContain(IntelligenceService);
    expect(metadata).toContain(ApiKeyGuard);
  });

  it("exports IntelligenceService so SchedulerModule can inject it", () => {
    const metadata = Reflect.getMetadata("exports", IntelligenceModule) as unknown[];
    expect(metadata).toEqual([IntelligenceService]);
  });

  it.each([
    ["TenantRepository", TenantRepository],
    ["ListingRepository", ListingRepository],
    ["IntelligenceSignalsRepository", IntelligenceSignalsRepository],
    ["CompetitorPageRepository", CompetitorPageRepository],
  ])("provides %s from the SHARED SUPABASE_CLIENT (not a second connection)", (_name, klass) => {
    const metadata = Reflect.getMetadata("providers", IntelligenceModule) as FactoryProvider[];
    const provider = metadata.find((p) => p.provide === klass);
    expect(provider).toBeDefined();
    expect(provider?.inject).toEqual([SUPABASE_CLIENT]);
    const fakeClient = { from: () => undefined, channel: () => undefined } as never;
    expect(provider?.useFactory?.(fakeClient)).toBeInstanceOf(
      klass as new (...args: never[]) => unknown,
    );
  });

  it.each([
    ["SeasonalCalendarService", SeasonalCalendarService],
    ["GoogleTrendsService", GoogleTrendsService],
  ])("provides real %s via a no-arg useFactory", (_name, klass) => {
    const metadata = Reflect.getMetadata("providers", IntelligenceModule) as FactoryProvider[];
    const provider = metadata.find((p) => p.provide === klass);
    expect(provider).toBeDefined();
    expect(provider?.useFactory?.()).toBeInstanceOf(klass as new (...args: never[]) => unknown);
  });
});
