import { describe, expect, it } from "vitest";

import * as PublicApi from "../../src/index.js";

describe("public API surface (src/index.ts)", () => {
  it("exports the factory", () => {
    expect(PublicApi.TamaraAgentFactory).toBeDefined();
  });

  it("exports all seven use cases", () => {
    expect(PublicApi.RunOptimizationCycle).toBeDefined();
    expect(PublicApi.ExecuteDecision).toBeDefined();
    expect(PublicApi.GenerateCreativeBrief).toBeDefined();
    expect(PublicApi.GenerateDailyDigest).toBeDefined();
    expect(PublicApi.ApproveDecision).toBeDefined();
    expect(PublicApi.RejectDecision).toBeDefined();
    expect(PublicApi.GetAgentStatus).toBeDefined();
  });

  it("exports both named services", () => {
    expect(PublicApi.TamaraAgentService).toBeDefined();
    expect(PublicApi.DecisionEngineService).toBeDefined();
  });

  it("exports the DecisionType, AgentState, AdAngle, and TargetPersona enums", () => {
    expect(PublicApi.DecisionType.AUTO_EXECUTE).toBe("AUTO_EXECUTE");
    expect(PublicApi.AgentState.IDLE).toBe("IDLE");
    expect(PublicApi.AdAngle.DP_RINGAN).toBe("DP_RINGAN");
    expect(PublicApi.TargetPersona.PRIMARY_FAMILY).toBe("PRIMARY_FAMILY");
  });

  it("exports AgentError, DecisionError, ExecutionError, EscalationError", () => {
    expect(PublicApi.AgentError).toBeDefined();
    expect(PublicApi.DecisionError).toBeDefined();
    expect(PublicApi.ExecutionError).toBeDefined();
    expect(PublicApi.EscalationError).toBeDefined();
  });

  it("exports config helpers", () => {
    expect(PublicApi.parseMetaAdsAgentConfig).toBeDefined();
    expect(PublicApi.DEFAULT_META_ADS_AGENT_CONFIG).toBeDefined();
  });

  it("exports BusinessKnowledgeBase and the rest of the intelligence layer", () => {
    expect(PublicApi.BusinessKnowledgeBase).toBeDefined();
    expect(PublicApi.AngleRecommender).toBeDefined();
    expect(PublicApi.VerdictDecisionEngine).toBeDefined();
    expect(PublicApi.BudgetOptimizer).toBeDefined();
    expect(PublicApi.AudienceInsightEngine).toBeDefined();
    expect(PublicApi.CreativeIntelligence).toBeDefined();
    expect(PublicApi.CampaignHealthAnalyzer).toBeDefined();
    expect(PublicApi.OptimizationPipeline).toBeDefined();
  });

  it("exports value objects used for external construction", () => {
    expect(PublicApi.ConfidenceScore).toBeDefined();
    expect(PublicApi.DecisionId).toBeDefined();
    expect(PublicApi.ExecutionPlanId).toBeDefined();
    expect(PublicApi.CreativeBriefId).toBeDefined();
  });

  it("exports the three application services beyond TamaraAgentService/DecisionEngineService", () => {
    expect(PublicApi.ExecutionService).toBeDefined();
    expect(PublicApi.EscalationService).toBeDefined();
    expect(PublicApi.DigestService).toBeDefined();
  });

  it("exports MetaAdsAgentConfigSchema for direct Zod-schema consumers", () => {
    expect(PublicApi.MetaAdsAgentConfigSchema).toBeDefined();
  });

  it("MetaAdsAgentConfigSchema parses a minimal valid tenantId-only input", () => {
    const parsed = PublicApi.MetaAdsAgentConfigSchema.safeParse({ tenantId: "dss-motor" });
    expect(parsed.success).toBe(true);
  });

  it("re-exports DecisionEngineService as a constructible class", () => {
    expect(typeof PublicApi.DecisionEngineService).toBe("function");
  });

  it("exports HistoricalLearningService and HistoricalLearningError (AAOS-W1D-S1S2 S1)", () => {
    expect(PublicApi.HistoricalLearningService).toBeDefined();
    expect(typeof PublicApi.HistoricalLearningService).toBe("function");
    expect(PublicApi.HistoricalLearningError).toBeDefined();
  });

  it("exports MOBIX_BRAND, MOBIX_LOCATIONS, ANGLE_USP_MAP, TOP_UNITS (AAOS-W1D-S1S2 S2)", () => {
    expect(PublicApi.MOBIX_BRAND).toBeDefined();
    expect(PublicApi.MOBIX_LOCATIONS).toBeDefined();
    expect(PublicApi.ANGLE_USP_MAP).toBeDefined();
    expect(PublicApi.TOP_UNITS).toBeDefined();
  });

  it("exports KNOWN_PERFORMANCE_BASELINES, KNOWN_EVERGREEN_PATTERNS, KNOWN_FATIGUE_PATTERNS", () => {
    expect(PublicApi.KNOWN_PERFORMANCE_BASELINES).toBeDefined();
    expect(PublicApi.KNOWN_EVERGREEN_PATTERNS).toBeDefined();
    expect(PublicApi.KNOWN_FATIGUE_PATTERNS).toBeDefined();
  });

  it("exports HistoricalPeriod, EvergreenScore, and createSeasonalPattern", () => {
    expect(PublicApi.HistoricalPeriod).toBeDefined();
    expect(PublicApi.EvergreenScore).toBeDefined();
    expect(PublicApi.createSeasonalPattern).toBeDefined();
  });

  it("exports performanceBaselineKey helper", () => {
    expect(typeof PublicApi.performanceBaselineKey).toBe("function");
  });

  it("createWithFullContext is a static method on the exported TamaraAgentFactory", () => {
    expect(typeof PublicApi.TamaraAgentFactory.createWithFullContext).toBe("function");
  });
});
