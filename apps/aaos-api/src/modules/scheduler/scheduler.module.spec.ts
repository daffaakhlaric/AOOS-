import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { AbTestingModule } from "../abtesting/abtesting.module.js";
import { ActivityLogModule } from "../activity-log/activity-log.module.js";
import { AgentConfigModule } from "../agent-config/agent-config.module.js";
import { AgentRunsModule } from "../agent-runs/agent-runs.module.js";
import { AiJudgeModule } from "../ai-judge/ai-judge.module.js";
import { AuditLogModule } from "../audit-log/audit-log.module.js";
import { CampaignsModule } from "../campaigns/campaigns.module.js";
import { IntelligenceModule } from "../intelligence/intelligence.module.js";
import { ListingsModule } from "../listings/listings.module.js";
import { LlmModule } from "../llm/llm.module.js";
import { LookalikeModule } from "../lookalike/lookalike.module.js";
import { MarketIntelligenceModule } from "../market-intelligence/market-intelligence.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { ModeGuardModule } from "../mode-guard/mode-guard.module.js";
import { PendingActionsModule } from "../pending-actions/pending-actions.module.js";
import { PropertyObjectiveModule } from "../property-objective/property-objective.module.js";
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
  it("imports LlmModule/RecyclingModule/AbTestingModule/LookalikeModule/IntelligenceModule/ListingsModule/ModeGuardModule/ActivityLogModule/CampaignsModule/AgentRunsModule/AiJudgeModule/PendingActionsModule/AgentConfigModule/AuditLogModule/PropertyObjectiveModule/MarketIntelligenceModule so SchedulerService can inject every real dependency (Phase C: PROPERTY campaign-trigger wiring; AAOS EPIC S Phase S5: real CampaignsService.createPropertyCampaign wiring, LocationResolverModule no longer imported directly here — see scheduler.module.ts's own doc; AAOS-AI-JUDGE-SELF-IMPROVING Phase J2: AiJudgeModule added for the real SAMANTHA_ANALYZE judging wiring; AAOS-OPERATING-MODE-APPROVAL-GATE: PendingActionsModule added for the real APPROVAL-mode enqueue wiring; AAOS Self-Improving Phase SI-1: AgentConfigModule added for the real pause_cpl_multiplier config wiring; AAOS LOOP UPGRADE Sprint 6: AuditLogModule (Prompt 17 CAMPAIGN_PUBLISHED writer) and PropertyObjectiveModule (Prompt 15 business-context-aware reasoning) added; AAOS LOOP UPGRADE Sprint 7: MarketIntelligenceModule (Prompt 18 MARKET_INTELLIGENCE_REFRESH wiring) added)", () => {
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
      AgentRunsModule,
      AiJudgeModule,
      PendingActionsModule,
      AgentConfigModule,
      AuditLogModule,
      PropertyObjectiveModule,
      MarketIntelligenceModule,
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
