/**
 * "PUBLIC API: KnowledgeRetrieval, KnowledgeRetrievalSystem, KnowledgeRetriever,
 * KnowledgeQuery, KnowledgeQueryContext, KnowledgeQuerySession, KnowledgeResolver,
 * KnowledgeFilter, KnowledgeSearchPipeline, KnowledgeSearchStrategy,
 * KnowledgeRankingEngine, KnowledgePermissionResolver, KnowledgePolicyResolver,
 * KnowledgeSearchFactory, KnowledgeRetrievalRegistry, KnowledgeRetrievalValidator,
 * KnowledgeRetrievalMetrics, KnowledgeRetrievalHealth, KnowledgeRetrievalMonitor,
 * KnowledgeRetrievalEvents, KnowledgeRetrievalStatistics."
 * (docs/PROMPT-005.7D-KNOWLEDGE-RETRIEVAL.md). The 21 named exports below, plus the full
 * Domain/Contracts/Errors/Strategy/Factory-sub-class/Validator-stage surface a caller
 * needs to actually build and use them — matching the curation approach established in
 * `@aos/knowledge-engine`/`@aos/knowledge-runtime`/`@aos/knowledge-indexing`.
 */
export {
  KnowledgeRetrieval,
  type KnowledgeRetrievalOptions,
} from "./retrieval/knowledge-retrieval.js";

export { KnowledgeRetrievalSystem } from "./bootstrap/knowledge-retrieval-system.js";

export { KnowledgeRetriever, type RetrieveInput } from "./retriever/knowledge-retriever.js";

export {
  knowledgeQueryContextSchema,
  type KnowledgeQueryContext,
} from "./context/knowledge-query-context.js";
export {
  createKnowledgeQueryContext,
  type CreateKnowledgeQueryContextInput,
} from "./context/create-knowledge-query-context.js";

export { KnowledgeQuerySession } from "./session/knowledge-query-session.js";
export { KnowledgeQuerySessionState } from "./session/knowledge-query-session-state.js";
export type { KnowledgeQuerySessionRecord } from "./session/knowledge-query-session-record.js";

export { KnowledgeResolver } from "./resolver/knowledge-resolver.js";

export { KnowledgeFilter } from "./filter/knowledge-filter.js";

export {
  KnowledgeSearchPipeline,
  type KnowledgeSearchPipelineOptions,
  type RunSearchInput,
  type RunSearchOutput,
} from "./pipeline/knowledge-search-pipeline.js";

export { KnowledgeSearchStrategy } from "./strategy/knowledge-search-strategy.js";
export type { IKnowledgeSearchStrategy } from "./strategy/i-search-strategy.js";
export type {
  IKeywordSearchStrategy,
  IMetadataSearchStrategy,
  IRelationshipSearchStrategy,
  INamespaceSearchStrategy,
  IPolicySearchStrategy,
  IPermissionSearchStrategy,
  IHybridSearchStrategy,
  ISemanticSearchStrategy,
} from "./strategy/i-search-strategies.js";

export { KnowledgeRankingEngine } from "./ranking/knowledge-ranking-engine.js";

export { KnowledgePermissionResolver } from "./permission/knowledge-permission-resolver.js";
export type { IResultPermissionChecker } from "./permission/i-result-permission-checker.js";
export type { IQueryPermissionChecker } from "./permission/i-query-permission-checker.js";

export { KnowledgePolicyResolver } from "./policy/knowledge-policy-resolver.js";
export type { IQueryPolicyChecker } from "./policy/i-query-policy-checker.js";

export { KnowledgeSearchFactory } from "./factory/knowledge-search-factory.js";
export { KnowledgeQueryFactory, type CreateQueryInput } from "./factory/knowledge-query-factory.js";
export { KnowledgeSessionFactory } from "./factory/knowledge-session-factory.js";
export {
  KnowledgeResultFactory,
  type CreateResultInput,
} from "./factory/knowledge-result-factory.js";
export {
  KnowledgeRankingFactory,
  type RankingRegistration,
} from "./factory/knowledge-ranking-factory.js";
export { KnowledgeFilterFactory } from "./factory/knowledge-filter-factory.js";
export { KnowledgeSearchContextFactory } from "./factory/knowledge-search-context-factory.js";

export { KnowledgeRetrievalRegistry } from "./registry/knowledge-retrieval-registry.js";
export { KnowledgeRetrievalRegistryBucket } from "./registry/knowledge-retrieval-registry-bucket.js";

export { KnowledgeRetrievalValidator } from "./validator/knowledge-retrieval-validator.js";
export type {
  IKnowledgeRetrievalValidatorStage,
  KnowledgeRetrievalValidationInput,
  KnowledgeRetrievalValidationIssue,
  KnowledgeRetrievalValidationResult,
} from "./validator/i-knowledge-retrieval-validator.js";
export { QueryValidator } from "./validator/query-validator.js";
export { ContextValidator } from "./validator/context-validator.js";
export { SearchModeValidator } from "./validator/search-mode-validator.js";
export { FilterValidator } from "./validator/filter-validator.js";
export { LimitValidator } from "./validator/limit-validator.js";

export { KnowledgeRetrievalMetrics } from "./metrics/knowledge-retrieval-metrics.js";
export type {
  IKnowledgeRetrievalMetrics,
  KnowledgeRetrievalMetricsSnapshot,
} from "./metrics/i-knowledge-retrieval-metrics.js";

export { KnowledgeRetrievalHealth } from "./health/knowledge-retrieval-health.js";
export type {
  ComponentHealth,
  HealthStatus,
  KnowledgeRetrievalHealthReport,
} from "./health/i-health-check.js";

export { KnowledgeRetrievalMonitor } from "./monitoring/knowledge-retrieval-monitor.js";
export type { KnowledgeRetrievalDashboard } from "./monitoring/knowledge-retrieval-monitor.js";

export { KnowledgeRetrievalEvents } from "./events/knowledge-retrieval-events.js";
export { KnowledgeRetrievalEventType } from "./events/knowledge-retrieval-event-type.js";

export { KnowledgeRetrievalStatistics } from "./statistics/knowledge-retrieval-statistics.js";

export { KnowledgeRetrievalManager } from "./manager/knowledge-retrieval-manager.js";

export { KnowledgeRetrievalStateMachine } from "./state-machine/knowledge-retrieval-state-machine.js";
export type {
  IKnowledgeRetrievalStateMachine,
  KnowledgeRetrievalStateTransitionInput,
} from "./state-machine/i-state-machine.js";

export * from "./domain/index.js";
export * from "./contracts/index.js";
export * from "./errors/index.js";
export * from "./token/index.js";

export type { KnowledgeRetrievalConfig } from "./config/knowledge-retrieval-config.js";
