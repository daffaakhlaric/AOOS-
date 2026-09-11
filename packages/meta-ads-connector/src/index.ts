// Factory
export { MetaAdsConnectorFactory } from "./factories/MetaAdsConnectorFactory.js";
export type {
  MetaAdsConnector,
  MetaAdsConnectorFactoryOptions,
} from "./factories/MetaAdsConnectorFactory.js";

// Use Cases
export { PullCampaignData } from "./application/use-cases/PullCampaignData.js";
export type {
  DatePreset,
  PullCampaignDataInput,
} from "./application/use-cases/PullCampaignData.js";
export { ExecuteVerdict } from "./application/use-cases/ExecuteVerdict.js";
export type { ExecuteVerdictInput } from "./application/use-cases/ExecuteVerdict.js";
export {
  CreateCampaign,
  DEFAULT_DAILY_BUDGET_IDR,
} from "./application/use-cases/CreateCampaign.js";
export type {
  CreateCampaignInput,
  CreateCampaignOutput,
} from "./application/use-cases/CreateCampaign.js";
export { CreateAd } from "./application/use-cases/CreateAd.js";
export type { CreateAdInput, CreateAdOutput } from "./application/use-cases/CreateAd.js";
export { UploadCreativeAsset } from "./application/use-cases/UploadCreativeAsset.js";
export type {
  CreativeAssetType,
  UploadCreativeAssetInput,
  UploadCreativeAssetOutput,
} from "./application/use-cases/UploadCreativeAsset.js";
export { PauseCampaign } from "./application/use-cases/PauseCampaign.js";
export type {
  PauseCampaignInput,
  PauseCampaignOutput,
} from "./application/use-cases/PauseCampaign.js";
export { RestructureCampaign } from "./application/use-cases/RestructureCampaign.js";
export type {
  RestructureAdSetPauseResult,
  RestructureBudgetConsolidationInput,
  RestructureBudgetConsolidationResult,
  RestructureCampaignInput,
  RestructureCampaignOutput,
} from "./application/use-cases/RestructureCampaign.js";
export { ActivateCampaign } from "./application/use-cases/ActivateCampaign.js";
export type {
  ActivateCampaignInput,
  ActivateCampaignOutput,
} from "./application/use-cases/ActivateCampaign.js";
export { ActivateAd } from "./application/use-cases/ActivateAd.js";
export type { ActivateAdInput, ActivateAdOutput } from "./application/use-cases/ActivateAd.js";
export {
  SearchAdInterests,
  MAX_INTERESTS_PER_TERM,
} from "./application/use-cases/SearchAdInterests.js";
export type { SearchAdInterestsInput } from "./application/use-cases/SearchAdInterests.js";
export { SearchAdLocations } from "./application/use-cases/SearchAdLocations.js";
export type { SearchAdLocationsInput } from "./application/use-cases/SearchAdLocations.js";
export { ProcessLeadWebhook } from "./application/use-cases/ProcessLeadWebhook.js";
export type { ProcessLeadWebhookInput } from "./application/use-cases/ProcessLeadWebhook.js";
export { CreateCustomAudience } from "./application/use-cases/CreateCustomAudience.js";
export type {
  CreateCustomAudienceInput,
  CreateCustomAudienceOutput,
} from "./application/use-cases/CreateCustomAudience.js";
export { AddUsersToCustomAudience } from "./application/use-cases/AddUsersToCustomAudience.js";
export type {
  AddUsersToCustomAudienceInput,
  AddUsersToCustomAudienceOutput,
} from "./application/use-cases/AddUsersToCustomAudience.js";
export { CreateLookalikeAudience } from "./application/use-cases/CreateLookalikeAudience.js";
export type {
  CreateLookalikeAudienceInput,
  CreateLookalikeAudienceOutput,
} from "./application/use-cases/CreateLookalikeAudience.js";

// Services
export { MetaAdsSyncService } from "./application/services/MetaAdsSyncService.js";
export { VerdictExecutionService } from "./application/services/VerdictExecutionService.js";

// Domain — Entities
export type { AdAccount } from "./domain/entities/AdAccount.js";
export type { Campaign } from "./domain/entities/Campaign.js";
export type { AdSet } from "./domain/entities/AdSet.js";
export type { Ad } from "./domain/entities/Ad.js";
export type { Lead } from "./domain/entities/Lead.js";
export type { AdInterest } from "./domain/entities/AdInterest.js";
export type { AdLocation } from "./domain/entities/AdLocation.js";

// Domain — Value Objects
export { AdAccountId } from "./domain/value-objects/AdAccountId.js";
export { CampaignId } from "./domain/value-objects/CampaignId.js";
export { AdSetId } from "./domain/value-objects/AdSetId.js";
export { AdId } from "./domain/value-objects/AdId.js";
export { LeadId } from "./domain/value-objects/LeadId.js";
export { StableId } from "./domain/value-objects/StableId.js";
export { Spend } from "./domain/value-objects/Spend.js";
export { Budget } from "./domain/value-objects/Budget.js";
export { Rph } from "./domain/value-objects/Rph.js";
export { AdMetrics } from "./domain/value-objects/AdMetrics.js";
export { Verdict } from "./domain/value-objects/Verdict.js";
export { Branch } from "./domain/value-objects/Branch.js";
export { Funnel } from "./domain/value-objects/Funnel.js";
export { AdStatus } from "./domain/value-objects/AdStatus.js";
export { CampaignObjective } from "./domain/value-objects/CampaignObjective.js";
export { AdDestinationType } from "./domain/value-objects/AdDestinationType.js";
export { LeadType } from "./domain/value-objects/LeadType.js";
export { PublisherPlatform } from "./domain/value-objects/PublisherPlatform.js";
export type { CreativeAsset } from "./domain/value-objects/CreativeAsset.js";

// Domain — Events
export type { LeadReceived } from "./domain/events/LeadReceived.js";
export type { AdPaused } from "./domain/events/AdPaused.js";
export type { BudgetScaled } from "./domain/events/BudgetScaled.js";
export type { ObjectiveFixed } from "./domain/events/ObjectiveFixed.js";
export type { NewCampaignCreated } from "./domain/events/NewCampaignCreated.js";
export type { SyncCompleted } from "./domain/events/SyncCompleted.js";
export type { SyncFailed } from "./domain/events/SyncFailed.js";
export { MetaAdsConnectorEvents } from "./domain/events/MetaAdsConnectorEvents.js";

// Domain — Services
export { evaluateVerdict } from "./domain/services/VerdictEngine.js";
export type { VerdictEngineInput } from "./domain/services/VerdictEngine.js";
// Samantha Andromeda-Aware Campaign System, Sprint 1 — real creative-diversity scoring.
export {
  LOW_DIVERSITY_RATIO_THRESHOLD,
  MIN_ADS_FOR_DIVERSITY_SCORE,
  scoreCreativeDiversity,
} from "./domain/services/CreativeDiversityScoring.js";
export type {
  CreativeDiversityScore,
  CreativeDiversityStatus,
} from "./domain/services/CreativeDiversityScoring.js";

// Errors
export {
  MetaAdsConnectorError,
  MetaApiError,
  ApiServerError,
  RateLimitError,
  AuthError,
  PermissionError,
  WebhookError,
  SignatureVerificationError,
  TokenVerificationError,
  PayloadParseError,
  ConnectorConfigError,
} from "./domain/errors/index.js";

// Config
export type {
  MetaAdsConnectorConfig,
  MetaAdsConnectorConfigInput,
} from "./config/MetaAdsConnectorConfig.js";
export {
  MetaAdsConnectorConfigSchema,
  parseMetaAdsConnectorConfig,
} from "./config/MetaAdsConnectorConfig.js";
export {
  BRANCH_AUDIENCE_DEFAULTS,
  branchAudienceDefault,
} from "./config/BranchAudienceDefaults.js";
export type { BranchAudienceDefault } from "./config/BranchAudienceDefaults.js";
/** AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 2 — PROPERTY vertical's sibling config (spec Part 11). */
export {
  PROPERTY_BRANCH_AUDIENCE_DEFAULTS,
  propertyBranchAudienceDefault,
  HOUSING_SPECIAL_AD_CATEGORY,
  HOUSING_POLICY_WARNING,
} from "./config/PropertyBranchAudienceDefaults.js";

// Registry
export { AdAccountRegistry } from "./registry/AdAccountRegistry.js";

// Contracts
export type {
  IMetaAdsClient,
  PageCursor,
  CreateCampaignParams,
  CreateAdSetParams,
  CreateAdSetTargeting,
  MetaTargetingCity,
  CreateAdParams,
  CreateAdCreativeSpec,
  CreateAdCreativeVideoSpec,
  CreateAdCreativeImageSpec,
  MetaCreateResponse,
  CreateCustomAudienceParams,
  AddUsersToCustomAudienceParams,
  CreateLookalikeAudienceParams,
} from "./contracts/IMetaAdsClient.js";
export type {
  MetaAdAccountResponse,
  MetaAdInterest,
  MetaAdInterestSearchResponse,
  MetaAdLocation,
  MetaAdLocationSearchResponse,
  MetaVideoUploadResponse,
  MetaImageUploadResponse,
  MetaCustomAudienceCreateResponse,
  MetaCustomAudienceUsersResponse,
  MetaCampaignExpanded,
  MetaCampaignExpandedListResponse,
  MetaAdSetExpanded,
} from "./types/MetaApiTypes.js";
export { parseBusinessUseCaseUsage } from "./infrastructure/meta-api/UsageHeaderParser.js";
export type { BusinessUseCaseUsage } from "./infrastructure/meta-api/UsageHeaderParser.js";
export { MetaAdInterestSchema, MetaAdInterestSearchResponseSchema } from "./types/MetaApiTypes.js";
export { MetaAdLocationSchema, MetaAdLocationSearchResponseSchema } from "./types/MetaApiTypes.js";
export type { ILeadWebhookParser, RawLeadData } from "./contracts/ILeadWebhookParser.js";
export type {
  ExecutionAction,
  ExecutionResult,
  IVerdictExecutor,
  VerdictExecutionInput,
  VerdictTargetType,
} from "./contracts/IVerdictExecutor.js";
export type { IAdAccountRepository } from "./contracts/IAdAccountRepository.js";
export type { IRateLimiter, RateLimitStatus } from "./contracts/IRateLimiter.js";

// Infrastructure
export { MetaApiClient } from "./infrastructure/meta-api/MetaApiClient.js";
export { MetaApiRequestBuilder } from "./infrastructure/meta-api/MetaApiRequestBuilder.js";
export { MetaResponseMapper } from "./infrastructure/meta-api/MetaResponseMapper.js";
export { WebhookParser } from "./infrastructure/webhook/WebhookParser.js";
export { WebhookVerifier } from "./infrastructure/webhook/WebhookVerifier.js";
export { TokenBucketRateLimiter } from "./infrastructure/rate-limiter/TokenBucketRateLimiter.js";
export {
  ExponentialBackoffRetry,
  isRetryable,
} from "./infrastructure/retry/ExponentialBackoffRetry.js";

// Builders
export { CampaignBuilder } from "./builders/CampaignBuilder.js";
export { AdSetBuilder } from "./builders/AdSetBuilder.js";
export { AdBuilder } from "./builders/AdBuilder.js";
export { LeadBuilder } from "./builders/LeadBuilder.js";

// Utils
export {
  assignAdStableIds,
  assignAdSetStableIds,
  assignCampaignStableIds,
} from "./utils/StableIdAssigner.js";
export { classifyFunnel } from "./utils/FunnelClassifier.js";
export { extractBranch } from "./utils/BranchExtractor.js";
export { calculateActionBreakdown } from "./utils/D3Calculator.js";
export { centsToRupiah, rupiahToCents, formatIDR } from "./utils/CurrencyUtils.js";
export { hashPhoneForAudience, normalizePhoneForAudience } from "./utils/PhoneHasher.js";
export { classifyAudience } from "./utils/AudienceClassifier.js";
export type {
  AudienceLabel,
  AudienceTargetingSpec,
  AudienceTargetingCustomAudience,
  AudienceTargetingFlexibleSpecEntry,
  AudienceTargetingInterest,
  MetaCustomAudienceSubtype,
} from "./utils/AudienceClassifier.js";

// Mappers
export { mapCampaign } from "./mappers/CampaignMapper.js";
export { mapAdSet } from "./mappers/AdSetMapper.js";
export { mapAd } from "./mappers/AdMapper.js";
export { mapInsightRowToMetrics } from "./mappers/MetricsMapper.js";
export { mapLead, mapLeads, derivePublisherPlatform } from "./mappers/LeadMapper.js";
export { mapAdInterest } from "./mappers/AdInterestMapper.js";
export { mapAdLocation } from "./mappers/AdLocationMapper.js";
export type { AdIdentifiers, AdResolver } from "./mappers/LeadMapper.js";
