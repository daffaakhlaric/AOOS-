// Factory
export { SamanthaAgentFactory } from "./factories/SamanthaAgentFactory.js";
export type {
  SamanthaAgentRuntime,
  SamanthaAgentFactoryOptions,
  CreateWithFullContextOptions,
} from "./factories/SamanthaAgentFactory.js";

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
export { SamanthaAgentService } from "./application/services/SamanthaAgentService.js";
export { DecisionEngineService } from "./application/services/DecisionEngineService.js";
export { ExecutionService } from "./application/services/ExecutionService.js";
export { EscalationService } from "./application/services/EscalationService.js";
export { DigestService } from "./application/services/DigestService.js";

// Builders — AAOS-KALENDER-AKTIVITAS: exported (purely additively — both classes already existed
// and were already exercised by `RunOptimizationCycle`'s own internals, just never reachable from
// outside this package) so a caller can build a real `DailyDigest` WITHOUT running the full
// PERCEIVE→ANALYZE→DECIDE→ACT→REPORT→LEARN cycle (which would execute real, money-affecting
// AUTO_EXECUTE decisions against the live Meta API via `ExecuteVerdict`). `apps/aaos-api`'s
// `DAILY_DIGEST` scheduler handler is the first such caller: it builds an intentionally EMPTY
// `ExecutionPlan` (zero decisions — nothing was executed) and passes it straight to
// `DailyDigestBuilder`, producing an honest digest of real objective/campaign data with no
// side effects on any real campaign.
export { ExecutionPlanBuilder } from "./builders/ExecutionPlanBuilder.js";
export { DailyDigestBuilder } from "./builders/DailyDigestBuilder.js";
export type { DailyDigestBuildInput } from "./builders/DailyDigestBuilder.js";
export { MetaAdsAgentEvents } from "./domain/events/MetaAdsAgentEvents.js";

// Domain
export type { SamanthaAgent } from "./domain/entities/SamanthaAgent.js";
export type { CampaignDecision } from "./domain/entities/CampaignDecision.js";
export type { ExecutionPlan } from "./domain/entities/ExecutionPlan.js";
// AAOS-CREATIVE-REVIEW: `CreativeBrief` is now exported as a VALUE, not only as a type. Its
// constructor is private and its `props` field is `private`, so the class is nominally typed —
// `apps/aaos-api`'s creative module cannot hand `@aos/creative-agent`'s
// `ProcessCreativeBrief.execute(brief)` a structurally-compatible object literal, it must call the
// real `CreativeBrief.create(...)` validator. Purely additive (a value export also exports the type).
export { CreativeBrief } from "./domain/entities/CreativeBrief.js";
export type {
  CreativeBriefProps,
  CreativeBriefPriceContext,
} from "./domain/entities/CreativeBrief.js";
// The two literal-union types `CreativeBriefProps.urgency`/`.formats` are declared with. Real, and
// load-bearing: `@aos/creative-agent`'s `FormatDecider` branches on `"VIDEO_15S"`/`"VIDEO_30S"`/
// `"IMAGE_STORY"` members of `CreativeFormat` to pick its video/image specs.
export type { CreativeUrgency, CreativeFormat, PerAdFinding } from "./types/AgentTypes.js";
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
export { AnomalyDetector } from "./intelligence/AnomalyDetector.js";
export type {
  AdFrequencySignal,
  AnomalySeverity,
  FrequencyHighAnomaly,
} from "./intelligence/AnomalyDetector.js";
export { OptimizationPipeline } from "./intelligence/OptimizationPipeline.js";

// AAOS-SAMANTHA-INTELLIGENCE-LAYER Phase 1 — Seasonal Calendar + Inventory/Lead/Closing signals
export { SeasonalCalendarService } from "./intelligence/SeasonalCalendarService.js";
export type {
  IntelVertical,
  SeasonalEventType,
  SeasonalEventAngles,
  SeasonalEvent,
  SeasonalRecommendation,
} from "./intelligence/SeasonalCalendarService.js";
export { InventoryIntelService } from "./intelligence/InventoryIntelService.js";
export type {
  PropertyListingSnapshot,
  AutomotiveInventorySignal,
  PropertyInventorySignal,
} from "./intelligence/InventoryIntelService.js";
export { LeadIntelService } from "./intelligence/LeadIntelService.js";
export type { LeadIntelSignal } from "./intelligence/LeadIntelService.js";
export { ClosingIntelService } from "./intelligence/ClosingIntelService.js";
export type {
  UnitClosingSignal,
  BranchClosingSignal,
  ClosingIntelSignal,
} from "./intelligence/ClosingIntelService.js";

// AAOS-SAMANTHA-INTELLIGENCE-LAYER Phase 2 — Competitor Intel (Meta Ad Library). Not previously
// re-exported from this public index (an oversight left over from Phase 2) — added here in Phase
// 4 so `apps/aaos-api`'s new `intelligence` module can compose it without a disallowed deep import
// into this package's internals.
export {
  CompetitorIntelService,
  CompetitorIntelError,
  classifyAutomotiveAngle,
  classifyPropertyAngle,
  ALL_PROPERTY_ANGLE_VALUES,
  ALL_AUTOMOTIVE_ANGLE_VALUES,
} from "./intelligence/CompetitorIntelService.js";
export type {
  AdActiveStatus,
  CompetitorPageConfig,
  CompetitorAd,
  CompetitorSignal,
  CompetitorIntelServiceOptions,
} from "./intelligence/CompetitorIntelService.js";

// AAOS-SAMANTHA-INTELLIGENCE-LAYER Phase 3 — Google Trends signal service
export {
  GoogleTrendsService,
  GoogleTrendsError,
  interpretForCampaign,
  trendToAngle,
} from "./intelligence/GoogleTrendsService.js";
export type {
  TrendDirection,
  TrendsData,
  TrendSignal,
  GoogleTrendsServiceOptions,
} from "./intelligence/GoogleTrendsService.js";

// AAOS-SAMANTHA-INTELLIGENCE-LAYER Phase 4 — brand-campaign angle vocabulary (spec PART 2's
// `BRAND_ANGLES`, corrected onto a real, typed home — see BrandAngles.ts docstring).
export { BRAND_ANGLES, getBrandAngleIds } from "./intelligence/BrandAngles.js";
export type { BrandAngleDefinition, BrandCampaignObjective } from "./intelligence/BrandAngles.js";
