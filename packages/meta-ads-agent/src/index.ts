// Factory
export { TamaraAgentFactory } from "./factories/TamaraAgentFactory.js";
export type {
  TamaraAgentRuntime,
  TamaraAgentFactoryOptions,
  CreateWithFullContextOptions,
} from "./factories/TamaraAgentFactory.js";

// Use Cases
export { RunOptimizationCycle } from "./application/use-cases/RunOptimizationCycle.js";
export type {
  RunOptimizationCycleInput,
  RunOptimizationCycleOutput,
} from "./application/use-cases/RunOptimizationCycle.js";
export { ExecuteDecision } from "./application/use-cases/ExecuteDecision.js";
export type { ExecuteDecisionInput } from "./application/use-cases/ExecuteDecision.js";
export { GenerateCreativeBrief } from "./application/use-cases/GenerateCreativeBrief.js";
export type { GenerateCreativeBriefInput } from "./application/use-cases/GenerateCreativeBrief.js";
export { GenerateDailyDigest } from "./application/use-cases/GenerateDailyDigest.js";
export type { GenerateDailyDigestInput } from "./application/use-cases/GenerateDailyDigest.js";
export { ApproveDecision } from "./application/use-cases/ApproveDecision.js";
export type { ApproveDecisionInput } from "./application/use-cases/ApproveDecision.js";
export { RejectDecision } from "./application/use-cases/RejectDecision.js";
export type { RejectDecisionInput } from "./application/use-cases/RejectDecision.js";
export { GetAgentStatus } from "./application/use-cases/GetAgentStatus.js";
export type { GetAgentStatusOutput } from "./application/use-cases/GetAgentStatus.js";

// Services
export { TamaraAgentService } from "./application/services/TamaraAgentService.js";
export { DecisionEngineService } from "./application/services/DecisionEngineService.js";
export { ExecutionService } from "./application/services/ExecutionService.js";
export { EscalationService } from "./application/services/EscalationService.js";
export { DigestService } from "./application/services/DigestService.js";

// Domain
export type { TamaraAgent } from "./domain/entities/TamaraAgent.js";
export type { CampaignDecision } from "./domain/entities/CampaignDecision.js";
export type { ExecutionPlan } from "./domain/entities/ExecutionPlan.js";
export type { CreativeBrief, CreativeBriefPriceContext } from "./domain/entities/CreativeBrief.js";
export type { DailyDigest, DailyDigestTopPerformer } from "./domain/entities/DailyDigest.js";
export type { EscalationRequest } from "./domain/entities/EscalationRequest.js";
export type {
  AgentMemory,
  AnglePerformanceRecord,
  DecisionOutcome,
} from "./domain/entities/AgentMemory.js";
export { DecisionType } from "./domain/value-objects/DecisionType.js";
export { AgentState } from "./domain/value-objects/AgentState.js";
export { AdAngle } from "./domain/value-objects/AdAngle.js";
export { TargetPersona } from "./domain/value-objects/TargetPersona.js";
export { ConfidenceScore } from "./domain/value-objects/ConfidenceScore.js";
export { DecisionId } from "./domain/value-objects/DecisionId.js";
export { ExecutionPlanId } from "./domain/value-objects/ExecutionPlanId.js";
export { CreativeBriefId } from "./domain/value-objects/CreativeBriefId.js";

// Events
export type {
  AgentCycleStarted,
  AgentCycleCompleted,
  DecisionMade,
  DecisionExecuted,
  DecisionEscalated,
  CreativeBriefGenerated,
  DigestGenerated,
} from "./domain/events/index.js";

// Errors
export {
  AgentError,
  DecisionError,
  ExecutionError,
  EscalationError,
} from "./domain/errors/index.js";

// Config
export type { MetaAdsAgentConfig, MetaAdsAgentConfigInput } from "./config/MetaAdsAgentConfig.js";
export {
  MetaAdsAgentConfigSchema,
  parseMetaAdsAgentConfig,
  DEFAULT_META_ADS_AGENT_CONFIG,
} from "./config/MetaAdsAgentConfig.js";

// AAOS-W1D-S1S2 (S1) — Historical Learning domain types
export type { AdHistoricalRecord } from "./domain/entities/AdHistoricalRecord.js";
export { HistoricalPeriod } from "./domain/value-objects/HistoricalPeriod.js";
export { EvergreenScore } from "./domain/value-objects/EvergreenScore.js";
export type { PerformanceBaseline } from "./domain/value-objects/PerformanceBaseline.js";
export { performanceBaselineKey } from "./domain/value-objects/PerformanceBaseline.js";
export type { FatiguePattern } from "./domain/value-objects/FatiguePattern.js";
export type { SeasonalPattern } from "./domain/value-objects/SeasonalPattern.js";
export { createSeasonalPattern } from "./domain/value-objects/SeasonalPattern.js";
export type { NewUnitAlert } from "./domain/entities/AgentMemory.js";
export {
  HistoricalLearningService,
  type PullCampaignDataPort,
} from "./application/services/HistoricalLearningService.js";
export type {
  HistoricalLearnings,
  VerdictRecord,
} from "./application/services/HistoricalLearningService.js";
export { HistoricalLearningError } from "./domain/errors/index.js";

// AAOS-W1D-S1S2 (S2) — Mobix brand/inventory knowledge exports
export {
  MOBIX_BRAND,
  MOBIX_LOCATIONS,
  ANGLE_USP_MAP,
  TOP_UNITS,
  KNOWN_PERFORMANCE_BASELINES,
  KNOWN_EVERGREEN_PATTERNS,
  KNOWN_FATIGUE_PATTERNS,
} from "./intelligence/BusinessKnowledgeBase.js";
export type {
  LocationProfile,
  UnitProfile,
  EvergreenPatternSeed,
  MobixKnowledge,
} from "./intelligence/BusinessKnowledgeBase.js";

// Intelligence
export { BusinessKnowledgeBase } from "./intelligence/BusinessKnowledgeBase.js";
export { AngleRecommender } from "./intelligence/AngleRecommender.js";
export { VerdictDecisionEngine } from "./intelligence/VerdictDecisionEngine.js";
export { BudgetOptimizer } from "./intelligence/BudgetOptimizer.js";
export { AudienceInsightEngine } from "./intelligence/AudienceInsightEngine.js";
export { CreativeIntelligence } from "./intelligence/CreativeIntelligence.js";
export { CampaignHealthAnalyzer } from "./intelligence/CampaignHealthAnalyzer.js";
export { OptimizationPipeline } from "./intelligence/OptimizationPipeline.js";
