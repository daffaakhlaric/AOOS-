// Factory
export { ClosingTrackerFactory } from "./factories/ClosingTrackerFactory.js";
export type {
  ClosingTracker,
  ClosingTrackerFactoryOptions,
} from "./factories/ClosingTrackerFactory.js";

// Use Cases
export { GenerateClosingReport } from "./application/use-cases/GenerateClosingReport.js";
export type { GenerateClosingReportInput } from "./application/use-cases/GenerateClosingReport.js";
export { GetCampaignAttribution } from "./application/use-cases/GetCampaignAttribution.js";
export type { GetCampaignAttributionInput } from "./application/use-cases/GetCampaignAttribution.js";
export { GetBranchPerformance } from "./application/use-cases/GetBranchPerformance.js";
export type { GetBranchPerformanceInput } from "./application/use-cases/GetBranchPerformance.js";
export { GetUnitPerformance } from "./application/use-cases/GetUnitPerformance.js";
export type { GetUnitPerformanceInput } from "./application/use-cases/GetUnitPerformance.js";
export { FeedToSamantha } from "./application/use-cases/FeedToSamantha.js";
export type { FeedToSamanthaInput } from "./application/use-cases/FeedToSamantha.js";
export { CheckObjectiveCompletion } from "./application/use-cases/CheckObjectiveCompletion.js";
export type {
  CheckObjectiveCompletionInput,
  CheckObjectiveCompletionOutput,
} from "./application/use-cases/CheckObjectiveCompletion.js";
export { GetClosingPipeline } from "./application/use-cases/GetClosingPipeline.js";
export type { GetClosingPipelineInput } from "./application/use-cases/GetClosingPipeline.js";

// Services
export { ClosingAggregatorService } from "./application/services/ClosingAggregatorService.js";
export { AttributionEngineService } from "./application/services/AttributionEngineService.js";
export type {
  CampaignDirectory,
  CampaignMeta,
} from "./application/services/AttributionEngineService.js";
export { ReportGeneratorService } from "./application/services/ReportGeneratorService.js";
export { SamanthaFeedService } from "./application/services/SamanthaFeedService.js";
export type {
  SamanthaFeedData,
  SamanthaCampaignSignal,
  SamanthaBranchSignal,
  SamanthaObjectiveStatus,
  BudgetRecommendation,
} from "./application/services/SamanthaFeedService.js";

// Builders
export { ClosingReportBuilder } from "./builders/ClosingReportBuilder.js";
export { CampaignAttributionBuilder } from "./builders/CampaignAttributionBuilder.js";

// Domain — Entities
export type {
  ClosingReport,
  CampaignAttribution,
  BranchPerformance,
  UnitPerformance,
  SalesPerformance,
  ClosingPipeline,
  ClosingVerdict,
} from "./domain/entities/index.js";
export { resolveVerdict } from "./domain/entities/index.js";

// Domain — Value Objects
export type {
  RphSpk,
  ClosingRate,
  ReportPeriod,
  AttributionScore,
  TotalCommission,
  ConversionFunnel,
} from "./domain/value-objects/index.js";

// Domain — Events
export type {
  ClosingReportGenerated,
  MilestoneReached,
  CampaignAttributed,
  ObjectiveCompleted,
} from "./domain/events/index.js";
export { ClosingTrackerEvents } from "./domain/events/index.js";

// Domain — Errors
export {
  ClosingTrackerError,
  InsufficientDataError,
  AttributionError,
} from "./domain/errors/index.js";

// Contracts
export type { IClosingAggregator, ClosingDataset } from "./contracts/IClosingAggregator.js";
export type { IAttributionEngine } from "./contracts/IAttributionEngine.js";
export type { IReportGenerator } from "./contracts/IReportGenerator.js";
export type {
  ICampaignActivityProvider,
  ActiveCampaignSnapshot,
} from "./contracts/ICampaignActivityProvider.js";

// Config
export type {
  ClosingTrackerConfig,
  ClosingTrackerConfigInput,
} from "./config/ClosingTrackerConfig.js";
export {
  ClosingTrackerConfigSchema,
  parseClosingTrackerConfig,
  DEFAULT_CLOSING_TRACKER_CONFIG,
} from "./config/ClosingTrackerConfig.js";
