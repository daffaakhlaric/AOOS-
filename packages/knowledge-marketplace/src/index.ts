/**
 * "PUBLIC API: KnowledgeMarketplace, KnowledgeMarketplaceManager,
 * KnowledgeMarketplaceRegistry, KnowledgeMarketplaceResolver, KnowledgeMarketplaceValidator,
 * KnowledgeMarketplacePipeline, KnowledgeMarketplaceMiddleware, KnowledgeMarketplaceFactory,
 * KnowledgeMarketplaceContext, KnowledgeMarketplaceSession, KnowledgeMarketplaceLifecycle,
 * KnowledgeMarketplaceStateMachine, KnowledgeMarketplaceEvents, KnowledgeMarketplaceMetrics,
 * KnowledgeMarketplaceHealth, KnowledgeMarketplaceMonitoring, KnowledgeMarketplaceStatistics,
 * KnowledgeMarketplaceSystem." (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md). The 18 named
 * exports below, plus the full Domain/Contracts/Errors/Validator-stage surface a caller
 * needs to actually build and use them — matching the curation approach established by
 * `@aos/knowledge-policy`/`@aos/knowledge-versioning`. `KnowledgeMarketplace` is the
 * façade (`marketplace/knowledge-marketplace.ts`); the read-only per-listing domain view
 * it returns is exported separately as `KnowledgeMarketplaceRecord`
 * (`domain/knowledge-marketplace-record.ts`) to avoid a same-name collision.
 */

/* ---- Bootstrap ---- */
export { KnowledgeMarketplaceSystem } from "./bootstrap/knowledge-marketplace-system.js";

/* ---- Config ---- */
export type { KnowledgeMarketplaceConfig } from "./config/knowledge-marketplace-config.js";

/* ---- Context ---- */
export {
  createKnowledgeMarketplaceContext,
  type CreateKnowledgeMarketplaceContextInput,
} from "./context/create-knowledge-marketplace-context.js";
export { type KnowledgeMarketplaceContext } from "./context/knowledge-marketplace-context.js";

/* ---- Domain ---- */
export { KnowledgeMarketplaceRecord } from "./domain/knowledge-marketplace-record.js";
export {
  MarketplacePackageStatus,
  MARKETPLACE_STATE_TRANSITIONS,
  MARKETPLACE_TERMINAL_STATES,
  MARKETPLACE_SETTLED_STATES,
} from "./domain/marketplace-package-status.js";
export { MarketplaceType } from "./domain/marketplace-type.js";
export { MarketplaceCategoryName } from "./domain/marketplace-category-name.js";
export {
  BUILT_IN_CATEGORY_DEFINITIONS,
  isBuiltInCategory,
  type BuiltInCategoryDefinition,
} from "./domain/built-in-categories.js";
export { MarketplaceDependencyKind } from "./domain/marketplace-dependency-kind.js";
export { MarketplaceCertificationLevel } from "./domain/marketplace-certification-level.js";
export { EMPTY_MARKETPLACE_STATISTICS } from "./domain/marketplace-statistics-snapshot.js";
export type { MarketplacePackage } from "./domain/marketplace-package.js";
export type { MarketplaceListing } from "./domain/marketplace-listing.js";
export type { MarketplacePublisher } from "./domain/marketplace-publisher.js";
export type { MarketplaceCategory } from "./domain/marketplace-category.js";
export type { MarketplaceTag } from "./domain/marketplace-tag.js";
export type { MarketplaceCertification } from "./domain/marketplace-certification.js";
export type { MarketplaceCompatibility } from "./domain/marketplace-compatibility.js";
export type { MarketplaceDependency } from "./domain/marketplace-dependency.js";
export type { MarketplaceVersion } from "./domain/marketplace-version.js";
export type { MarketplaceStatisticsSnapshot } from "./domain/marketplace-statistics-snapshot.js";
export type { MarketplaceMetadata } from "./domain/marketplace-metadata.js";
export type { MarketplaceInstallationMetadata } from "./domain/marketplace-installation-metadata.js";
export type { MarketplaceAuditEntry } from "./domain/marketplace-audit.js";
export type { MarketplaceLogEntry } from "./domain/marketplace-log.js";
export type { MarketplaceTrace } from "./domain/marketplace-trace.js";
export type {
  KnowledgeMarketplaceExecution,
  MarketplaceHistoryEntry,
} from "./domain/knowledge-marketplace-execution.js";

/* ---- Contracts ---- */
export type { IKnowledgeMarketplace } from "./contracts/i-knowledge-marketplace.js";
export type {
  IKnowledgeMarketplaceValidator,
  KnowledgeMarketplaceValidationInput,
  MarketplaceValidationIssue,
  MarketplaceValidationResult,
} from "./contracts/i-knowledge-marketplace-validator.js";
export type {
  AddCompatibilityInput,
  AddCompatibilityResult,
  AddDependencyInput,
  AddDependencyResult,
  ArchiveListingInput,
  BrowseCategoryInput,
  BrowseCategoryResult,
  CertifyListingInput,
  CertifyListingResult,
  CreateListingInput,
  DeprecateListingInput,
  PublishListingInput,
  RemoveDependencyInput,
  RemoveListingInput,
  ReviewListingInput,
  SearchMetadataInput,
  SearchMetadataResult,
  SubmitListingInput,
  SuspendListingInput,
  UpdateListingInput,
  UpdateMetadataInput,
} from "./contracts/i-knowledge-marketplace-operations.js";
export type { IKnowledgeMarketplaceStorage } from "./contracts/i-knowledge-marketplace-storage.js";
export type { IKnowledgeMarketplacePublisher } from "./contracts/i-knowledge-marketplace-publisher.js";
export type { IKnowledgeMarketplaceReviewer } from "./contracts/i-knowledge-marketplace-reviewer.js";
export type { IKnowledgeMarketplaceSearchProvider } from "./contracts/i-knowledge-marketplace-search-provider.js";
export type { IKnowledgeMarketplaceInstaller } from "./contracts/i-knowledge-marketplace-installer.js";
export type { IKnowledgeMarketplaceLicenseProvider } from "./contracts/i-knowledge-marketplace-license-provider.js";
export type { IKnowledgeMarketplaceBillingProvider } from "./contracts/i-knowledge-marketplace-billing-provider.js";
export type { IKnowledgeMarketplaceRecommendationProvider } from "./contracts/i-knowledge-marketplace-recommendation-provider.js";
export type { IKnowledgeMarketplaceAnalyticsProvider } from "./contracts/i-knowledge-marketplace-analytics-provider.js";
export type { IKnowledgeMarketplaceApprovalProvider } from "./contracts/i-knowledge-marketplace-approval-provider.js";
export type { IKnowledgeGeneratorAiMarketplace } from "./contracts/i-knowledge-generator-ai-marketplace.js";
export type { IKnowledgeQualityEngineMarketplace } from "./contracts/i-knowledge-quality-engine-marketplace.js";
export type { IKnowledgeValidatorAiMarketplace } from "./contracts/i-knowledge-validator-ai-marketplace.js";

/* ---- Errors ---- */
export { KnowledgeMarketplaceException } from "./errors/knowledge-marketplace-exception.js";
export { DuplicateMarketplaceEntryException } from "./errors/duplicate-marketplace-entry-exception.js";
export { IllegalMarketplaceTransitionException } from "./errors/illegal-marketplace-transition-exception.js";
export { InvalidMarketplaceMetadataException } from "./errors/invalid-marketplace-metadata-exception.js";
export { MarketplaceNotFoundException } from "./errors/marketplace-not-found-exception.js";
export { MarketplaceOperationException } from "./errors/marketplace-operation-exception.js";
export { MarketplaceValidationException } from "./errors/marketplace-validation-exception.js";
export { MarketplaceConfigurationException } from "./errors/marketplace-configuration-exception.js";
export { MarketplaceSessionException } from "./errors/marketplace-session-exception.js";
export { MarketplaceLeaseException } from "./errors/marketplace-lease-exception.js";
export { MarketplaceDependencyException } from "./errors/marketplace-dependency-exception.js";
export { MarketplaceCompatibilityException } from "./errors/marketplace-compatibility-exception.js";
export { MarketplaceCategoryException } from "./errors/marketplace-category-exception.js";

/* ---- Events ---- */
export { KnowledgeMarketplaceEventType } from "./events/knowledge-marketplace-event-type.js";
export { KnowledgeMarketplaceEvents } from "./events/knowledge-marketplace-events.js";

/* ---- Factory ---- */
export { KnowledgeMarketplaceFactory } from "./factory/knowledge-marketplace-factory.js";

/* ---- Health ---- */
export { KnowledgeMarketplaceHealth } from "./health/knowledge-marketplace-health.js";
export type {
  HealthStatus,
  ComponentHealth,
  KnowledgeMarketplaceHealthReport,
} from "./health/i-health-check.js";

/* ---- Lifecycle ---- */
export { KnowledgeMarketplaceLifecycle } from "./lifecycle/knowledge-marketplace-lifecycle.js";

/* ---- Manager ---- */
export { KnowledgeMarketplaceManager } from "./manager/knowledge-marketplace-manager.js";

/* ---- Marketplace (Public API façade) ---- */
export { KnowledgeMarketplace } from "./marketplace/knowledge-marketplace.js";

/* ---- Metrics ---- */
export { KnowledgeMarketplaceMetrics } from "./metrics/knowledge-marketplace-metrics.js";
export type {
  IKnowledgeMarketplaceMetricsCollector,
  KnowledgeMarketplaceMetricsSnapshot,
} from "./metrics/i-knowledge-marketplace-metrics-collector.js";

/* ---- Middleware ---- */
export {
  KnowledgeMarketplaceMiddleware,
  type MarketplaceMiddleware,
  type MarketplaceMiddlewareNext,
} from "./middleware/knowledge-marketplace-middleware.js";

/* ---- Monitoring ---- */
export {
  KnowledgeMarketplaceMonitoring,
  type KnowledgeMarketplaceDashboard,
} from "./monitoring/knowledge-marketplace-monitoring.js";

/* ---- Pipeline ---- */
export {
  KnowledgeMarketplacePipeline,
  type RunMarketplacePipelineInput,
} from "./pipeline/knowledge-marketplace-pipeline.js";

/* ---- Registry ---- */
export { KnowledgeMarketplaceRegistry } from "./registry/knowledge-marketplace-registry.js";
export { KnowledgeMarketplaceRegistryBucket } from "./registry/knowledge-marketplace-registry-bucket.js";
export type { MarketplaceRegistryEntry } from "./registry/marketplace-registry-entry.js";

/* ---- Resolver ---- */
export { KnowledgeMarketplaceResolver } from "./resolver/knowledge-marketplace-resolver.js";

/* ---- Session ---- */
export { KnowledgeMarketplaceSession } from "./session/knowledge-marketplace-session.js";
export { KnowledgeMarketplaceSessionState } from "./session/knowledge-marketplace-session-state.js";
export type { KnowledgeMarketplaceSessionRecord } from "./session/knowledge-marketplace-session-record.js";

/* ---- State Machine ---- */
export { KnowledgeMarketplaceStateMachine } from "./state-machine/knowledge-marketplace-state-machine.js";

/* ---- Statistics ---- */
export { KnowledgeMarketplaceStatistics } from "./statistics/knowledge-marketplace-statistics.js";

/* ---- Token ---- */
export {
  generateKnowledgeMarketplaceToken,
  isKnowledgeMarketplaceToken,
} from "./token/knowledge-marketplace-token.js";

/* ---- Validator ---- */
export { KnowledgeMarketplaceValidator } from "./validator/knowledge-marketplace-validator.js";
export { IdentityValidator } from "./validator/identity-validator.js";
export { MetadataValidator } from "./validator/metadata-validator.js";
export { CategoryValidator } from "./validator/category-validator.js";
export { PublisherValidator } from "./validator/publisher-validator.js";
export { DependencyValidator } from "./validator/dependency-validator.js";
export { CompatibilityValidator } from "./validator/compatibility-validator.js";
export { VersionValidator } from "./validator/version-validator.js";
export { CertificationValidator } from "./validator/certification-validator.js";
export { ConfigurationValidator } from "./validator/configuration-validator.js";
export { IntegrityValidator } from "./validator/integrity-validator.js";
