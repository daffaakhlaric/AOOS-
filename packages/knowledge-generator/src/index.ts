/**
 * "PUBLIC API: KnowledgeGenerator, KnowledgeGeneratorManager, KnowledgeGeneratorRegistry,
 * KnowledgeGeneratorResolver, KnowledgeGeneratorValidator, KnowledgeGeneratorPipeline,
 * KnowledgeGeneratorMiddleware, KnowledgeGeneratorFactory, KnowledgeGeneratorContext,
 * KnowledgeGeneratorSession, KnowledgeGeneratorLifecycle, KnowledgeGeneratorStateMachine,
 * KnowledgeGeneratorEvents, KnowledgeGeneratorMetrics, KnowledgeGeneratorHealth,
 * KnowledgeGeneratorMonitoring, KnowledgeGeneratorStatistics, KnowledgeGeneratorSystem."
 * (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md). The 18 named exports below, plus the full
 * Domain/Contracts/Errors/Validator-stage surface a caller needs to actually build and
 * use them — matching the curation approach established by `@aos/knowledge-marketplace`.
 * `KnowledgeGenerator` is the façade (`generator/knowledge-generator.ts`); the read-only
 * per-generation domain view it returns is exported separately as
 * `KnowledgeGenerationRecord` (`domain/knowledge-generation-record.ts`) to avoid a
 * same-name collision.
 */

/* ---- Bootstrap ---- */
export { KnowledgeGeneratorSystem } from "./bootstrap/knowledge-generator-system.js";

/* ---- Config ---- */
export type { KnowledgeGeneratorConfig } from "./config/knowledge-generator-config.js";

/* ---- Context ---- */
export {
  createKnowledgeGeneratorContext,
  type CreateKnowledgeGeneratorContextInput,
} from "./context/create-knowledge-generator-context.js";
export { type KnowledgeGeneratorContext } from "./context/knowledge-generator-context.js";

/* ---- Domain ---- */
export { KnowledgeGenerationRecord } from "./domain/knowledge-generation-record.js";
export {
  KnowledgeGenerationState,
  KNOWLEDGE_GENERATION_STATE_TRANSITIONS,
  KNOWLEDGE_GENERATION_TERMINAL_STATES,
  KNOWLEDGE_GENERATION_SETTLED_STATES,
} from "./domain/knowledge-generation-state.js";
export { KnowledgeGenerationAssetType } from "./domain/knowledge-generation-asset-type.js";
export { KnowledgeGenerationProviderType } from "./domain/knowledge-generation-provider-type.js";
export { KnowledgeGenerationMode } from "./domain/knowledge-generation-mode.js";
export { KnowledgeGeneratorSessionState } from "./domain/knowledge-generator-session-state.js";
export {
  evaluateKnowledgeGenerationPolicy,
  type KnowledgeGenerationPolicyEvaluationInput,
  type KnowledgeGenerationPolicyEvaluationResult,
} from "./domain/knowledge-generation-policy.js";
export { EMPTY_KNOWLEDGE_GENERATION_STATISTICS } from "./domain/knowledge-generation-statistics-snapshot.js";
export type { KnowledgeGenerationStatisticsSnapshot } from "./domain/knowledge-generation-statistics-snapshot.js";
export type { KnowledgeGeneration } from "./domain/knowledge-generation.js";
export type { KnowledgeGenerationJob } from "./domain/knowledge-generation-job.js";
export type { KnowledgeGenerationSession } from "./domain/knowledge-generation-session.js";
export type { KnowledgeGenerationRequest } from "./domain/knowledge-generation-request.js";
export type { KnowledgeGenerationResult } from "./domain/knowledge-generation-result.js";
export type { KnowledgeGenerationContext } from "./domain/knowledge-generation-context.js";
export type { KnowledgeGenerationPromptReference } from "./domain/knowledge-generation-prompt-reference.js";
export type { KnowledgeGenerationMetadata } from "./domain/knowledge-generation-metadata.js";
export type { KnowledgeGenerationConfiguration } from "./domain/knowledge-generation-configuration.js";
export type { KnowledgeGenerationPolicy } from "./domain/knowledge-generation-policy.js";
export type { KnowledgeGenerationAudit } from "./domain/knowledge-generation-audit.js";
export type { KnowledgeGenerationLogEntry } from "./domain/knowledge-generation-log-entry.js";
export type { KnowledgeGenerationHistoryEntry } from "./domain/knowledge-generation-history-entry.js";
export type { KnowledgeGeneratorExecution } from "./domain/knowledge-generator-execution.js";

/* ---- Contracts ---- */
export type { IKnowledgeGenerator } from "./contracts/i-knowledge-generator.js";
export type {
  IKnowledgeGeneratorValidator,
  KnowledgeGeneratorValidationInput,
  GeneratorValidationIssue,
  GeneratorValidationResult,
} from "./contracts/i-knowledge-generator-validator.js";
export type {
  CreateGenerationInput,
  GenerationTokenInput,
  FailGenerationInput,
  CompleteGenerationInput,
  CompleteGenerationResultInput,
  OpenGeneratorSessionInput,
  GeneratorSessionTokenInput,
  CreateGenerationJobInput,
  CreateGenerationJobResult,
  GenerationJobTokenInput,
  FailGenerationJobInput,
  ListGenerationsResult,
} from "./contracts/i-knowledge-generator-operations.js";
export type { IKnowledgeGenerationProvider } from "./contracts/i-knowledge-generation-provider.js";
export type { IKnowledgePromptProvider } from "./contracts/i-knowledge-prompt-provider.js";
export type { IKnowledgeContextProvider } from "./contracts/i-knowledge-context-provider.js";
export type { IKnowledgeGenerationPolicy } from "./contracts/i-knowledge-generation-policy.js";
export type { IKnowledgeGenerationOptimizer } from "./contracts/i-knowledge-generation-optimizer.js";
export type { IKnowledgeGenerationCache } from "./contracts/i-knowledge-generation-cache.js";
export type { IKnowledgeGenerationStorage } from "./contracts/i-knowledge-generation-storage.js";
export type { IKnowledgeGenerationPublisher } from "./contracts/i-knowledge-generation-publisher.js";
export type { IKnowledgeGenerationAuditor } from "./contracts/i-knowledge-generation-auditor.js";
export type { IKnowledgeGenerationScheduler } from "./contracts/i-knowledge-generation-scheduler.js";
export type { IKnowledgeGenerationCostProvider } from "./contracts/i-knowledge-generation-cost-provider.js";
export type { IKnowledgeGenerationStreamingProvider } from "./contracts/i-knowledge-generation-streaming-provider.js";
export type { IKnowledgeQualityEngineGenerator } from "./contracts/i-knowledge-quality-engine-generator.js";
export type { IKnowledgeValidatorAiGenerator } from "./contracts/i-knowledge-validator-ai-generator.js";
export type { IEmbeddingManagerGenerator } from "./contracts/i-embedding-manager-generator.js";

/* ---- Errors ---- */
export { KnowledgeGeneratorException } from "./errors/knowledge-generator-exception.js";
export { GeneratorNotFoundException } from "./errors/generator-not-found-exception.js";
export { DuplicateGeneratorEntryException } from "./errors/duplicate-generator-entry-exception.js";
export { IllegalGenerationTransitionException } from "./errors/illegal-generation-transition-exception.js";
export { InvalidGenerationMetadataException } from "./errors/invalid-generation-metadata-exception.js";
export { GenerationValidationException } from "./errors/generation-validation-exception.js";
export { GeneratorOperationException } from "./errors/generator-operation-exception.js";
export { GeneratorConfigurationException } from "./errors/generator-configuration-exception.js";
export { GeneratorSessionException } from "./errors/generator-session-exception.js";
export { GeneratorLeaseException } from "./errors/generator-lease-exception.js";
export { GenerationPolicyException } from "./errors/generation-policy-exception.js";
export { GenerationProviderException } from "./errors/generation-provider-exception.js";
export { GenerationPromptException } from "./errors/generation-prompt-exception.js";
export { GenerationContextException } from "./errors/generation-context-exception.js";

/* ---- Events ---- */
export { KnowledgeGeneratorEventType } from "./events/knowledge-generator-event-type.js";
export { KnowledgeGeneratorEvents } from "./events/knowledge-generator-events.js";

/* ---- Factory ---- */
export { KnowledgeGeneratorFactory } from "./factory/knowledge-generator-factory.js";

/* ---- Generator (Public API façade) ---- */
export { KnowledgeGenerator } from "./generator/knowledge-generator.js";

/* ---- Health ---- */
export { KnowledgeGeneratorHealth } from "./health/knowledge-generator-health.js";
export type {
  HealthStatus,
  ComponentHealth,
  KnowledgeGeneratorHealthReport,
} from "./health/i-health-check.js";

/* ---- Lifecycle ---- */
export { KnowledgeGeneratorLifecycle } from "./lifecycle/knowledge-generator-lifecycle.js";

/* ---- Manager ---- */
export { KnowledgeGeneratorManager } from "./manager/knowledge-generator-manager.js";

/* ---- Metrics ---- */
export { KnowledgeGeneratorMetrics } from "./metrics/knowledge-generator-metrics.js";
export type {
  IKnowledgeGeneratorMetricsCollector,
  KnowledgeGeneratorMetricsSnapshot,
} from "./metrics/i-knowledge-generator-metrics-collector.js";

/* ---- Middleware ---- */
export {
  KnowledgeGeneratorMiddleware,
  type GeneratorMiddleware,
  type GeneratorMiddlewareNext,
} from "./middleware/knowledge-generator-middleware.js";

/* ---- Monitoring ---- */
export {
  KnowledgeGeneratorMonitoring,
  type KnowledgeGeneratorDashboard,
} from "./monitoring/knowledge-generator-monitoring.js";

/* ---- Pipeline ---- */
export {
  KnowledgeGeneratorPipeline,
  type RunGeneratorPipelineInput,
} from "./pipeline/knowledge-generator-pipeline.js";

/* ---- Registry ---- */
export { KnowledgeGeneratorRegistry } from "./registry/knowledge-generator-registry.js";
export { KnowledgeGeneratorRegistryBucket } from "./registry/knowledge-generator-registry-bucket.js";
export type { KnowledgeGeneratorRegistryEntry } from "./registry/knowledge-generator-registry-entry.js";

/* ---- Resolver ---- */
export { KnowledgeGeneratorResolver } from "./resolver/knowledge-generator-resolver.js";

/* ---- Session ---- */
export { KnowledgeGeneratorSession } from "./session/knowledge-generator-session.js";
export type { KnowledgeGeneratorSessionRecord } from "./session/knowledge-generator-session-record.js";

/* ---- State Machine ---- */
export { KnowledgeGeneratorStateMachine } from "./state-machine/knowledge-generator-state-machine.js";

/* ---- Statistics ---- */
export { KnowledgeGeneratorStatistics } from "./statistics/knowledge-generator-statistics.js";

/* ---- Token ---- */
export {
  generateKnowledgeGeneratorToken,
  isKnowledgeGeneratorToken,
} from "./token/knowledge-generator-token.js";

/* ---- Validator ---- */
export { KnowledgeGeneratorValidator } from "./validator/knowledge-generator-validator.js";
export { IdentityValidator } from "./validator/identity-validator.js";
export { MetadataValidator } from "./validator/metadata-validator.js";
export { RequestValidator } from "./validator/request-validator.js";
export { ContextValidator } from "./validator/context-validator.js";
export { PromptValidator } from "./validator/prompt-validator.js";
export { PolicyValidator } from "./validator/policy-validator.js";
export { ProviderValidator } from "./validator/provider-validator.js";
export { ConfigurationValidator } from "./validator/configuration-validator.js";
export { LifecycleValidator } from "./validator/lifecycle-validator.js";
export { DependencyValidator } from "./validator/dependency-validator.js";
export { IntegrityValidator } from "./validator/integrity-validator.js";
export { AuditValidator } from "./validator/audit-validator.js";
