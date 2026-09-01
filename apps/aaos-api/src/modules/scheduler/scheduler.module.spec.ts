import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { AbTestingModule } from "../abtesting/abtesting.module.js";
import { ActivityLogModule } from "../activity-log/activity-log.module.js";
import { CampaignsModule } from "../campaigns/campaigns.module.js";
import { IntelligenceModule } from "../intelligence/intelligence.module.js";
import { ListingsModule } from "../listings/listings.module.js";
import { LlmModule } from "../llm/llm.module.js";
import { LookalikeModule } from "../lookalike/lookalike.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { ModeGuardModule } from "../mode-guard/mode-guard.module.js";
import { RecyclingModule } from "../recycling/recycling.module.js";

import { CalendarEventRepository } from "./infrastructure/calendar-event.repository.js";
import { SchedulerController } from "./scheduler.controller.js";
import { SchedulerModule } from "./scheduler.module.js";
import { SchedulerService } from "./scheduler.service.js";

type FactoryProvider = {
  provide?: unknown;
  useFactory?: (...args: never[]) => unknown;
  inject?: unknown[];
};

describe("SchedulerModule", () => {
  it("imports LlmModule/RecyclingModule/AbTestingModule/LookalikeModule/IntelligenceModule/ListingsModule/ModeGuardModule/ActivityLogModule/CampaignsModule so SchedulerService can inject every real dependency (Phase C: PROPERTY campaign-trigger wiring; AAOS EPIC S Phase S5: real CampaignsService.createPropertyCampaign wiring, LocationResolverModule no longer imported directly here — see scheduler.module.ts's own doc)", () => {
    const metadata = Reflect.getMetadata("imports", SchedulerModule) as unknown[];
    expect(metadata).toEqual([
      LlmModule,
      RecyclingModule,
      AbTestingModule,
      LookalikeModule,
      IntelligenceModule,
      ListingsModule,
      ModeGuardModule,
      ActivityLogModule,
      CampaignsModule,
    ]);
  });

  it("registers SchedulerController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", SchedulerModule) as unknown[];
    expect(metadata).toEqual([SchedulerController]);
  });

  it("registers SchedulerService and ApiKeyGuard as class providers", () => {
    const metadata = Reflect.getMetadata("providers", SchedulerModule) as unknown[];
    expect(metadata).toContain(SchedulerService);
    expect(metadata).toContain(ApiKeyGuard);
  });

  it("provides CalendarEventRepository from the SHARED SUPABASE_CLIENT (not a second connection)", () => {
    const metadata = Reflect.getMetadata("providers", SchedulerModule) as FactoryProvider[];
    const provider = metadata.find((p) => p.provide === CalendarEventRepository);
    expect(provider).toBeDefined();
    expect(provider?.inject).toEqual([SUPABASE_CLIENT]);
    const fakeClient = { from: () => undefined, channel: () => undefined } as never;
    expect(provider?.useFactory?.(fakeClient)).toBeInstanceOf(CalendarEventRepository);
  });
});
