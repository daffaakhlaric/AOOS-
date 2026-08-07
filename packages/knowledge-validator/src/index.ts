/**
 * "PUBLIC API: KnowledgeValidator, KnowledgeValidatorManager, KnowledgeValidatorRegistry,
 * KnowledgeValidatorResolver, KnowledgeValidatorValidator, KnowledgeValidatorPipeline,
 * KnowledgeValidatorMiddleware, KnowledgeValidatorFactory, KnowledgeValidatorContext,
 * KnowledgeValidatorSession, KnowledgeValidatorLifecycle, KnowledgeValidatorStateMachine,
 * KnowledgeValidatorEvents, KnowledgeValidatorMetrics, KnowledgeValidatorHealth,
 * KnowledgeValidatorMonitoring, KnowledgeValidatorStatistics, KnowledgeValidatorSystem."
 * (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md). The 18 named exports below, plus the
 * full Domain/Contracts/Errors/Validator-stage surface a caller needs to actually build
 * and use them — matching the curation approach established by
 * `@aos/knowledge-quality`/`@aos/knowledge-marketplace`. `KnowledgeValidator` is the
 * façade (`validation/knowledge-validator.ts`); the read-only per-validation domain view
 * it returns is exported separately as `KnowledgeValidationRecord`
 * (`domain/knowledge-validation-record.ts`) to avoid a same-name collision. Note the
 * distinct `KnowledgeValidatorValidator` — the 12-stage aggregator — is ALSO a named
 * Public API export per the spec's own list, sitting alongside the `KnowledgeValidator`
 * façade; see docs/005.7M-KNOWLEDGE-VALIDATOR-AI-REPORT.md — "Pipeline" for the full
 * triple "Validation" naming distinction.
 */

/* ---- Bootstrap ---- */
export { KnowledgeValidatorSystem } from "./bootstrap/knowledge-validator-system.js";

/* ---- Config ---- */
export type { KnowledgeValidatorConfig } from "./config/knowledge-validator-config.js";

/* ---- Context ---- */
export {
  createKnowledgeValidatorContext,
  type CreateKnowledgeValidatorContextInput,
} from "./context/create-knowledge-validator-context.js";
export { type KnowledgeValidatorContext } from "./context/knowledge-validator-context.js";

/* ---- Domain ---- */
export { KnowledgeValidationRecord } from "./domain/knowledge-validation-record.js";
export {
  KnowledgeValidationState,
  KNOWLEDGE_VALIDATION_STATE_TRANSITIONS,
  KNOWLEDGE_VALIDATION_TERMINAL_STATES,
  KNOWLEDGE_VALIDATION_SETTLED_STATES,
} from "./domain/knowledge-validation-state.js";
export { KnowledgeValidationCategory } from "./domain/knowledge-validation-category.js";
export {
  KnowledgeValidationDecisionValue,
  APPROVAL_DECISION_VALUES,
  REJECTION_DECISION_VALUES,
} from "./domain/knowledge-validation-decision-value.js";
export { KnowledgeValidationSessionState } from "./domain/knowledge-validation-session-state.js";
export {
  evaluateKnowledgeValidationPolicy,
  type KnowledgeValidationPolicyEvaluationInput,
  type KnowledgeValidationPolicyEvaluationResult,
} from "./domain/knowledge-validation-policy.js";
export { EMPTY_KNOWLEDGE_VALIDATION_STATISTICS } from "./domain/knowledge-validation-statistics-snapshot.js";
export type { KnowledgeValidationStatisticsSnapshot } from "./domain/knowledge-validation-statistics-snapshot.js";
export type { KnowledgeValidation } from "./domain/knowledge-validation.js";
export type { KnowledgeValidationJob } from "./domain/knowledge-validation-job.js";
export type { KnowledgeValidationSession } from "./domain/knowledge-validation-session.js";
export type { KnowledgeValidationRequest } from "./domain/knowledge-validation-request.js";
export type { KnowledgeValidationMetadata } from "./domain/knowledge-validation-metadata.js";
export type { KnowledgeValidationConfiguration } from "./domain/knowledge-validation-configuration.js";
export type { KnowledgeValidationPolicy } from "./domain/knowledge-validation-policy.js";
export type { KnowledgeValidationRule } from "./domain/knowledge-validation-rule.js";
export type { KnowledgeValidationDecision } from "./domain/knowledge-validation-decision.js";
export {
  type KnowledgeValidationFinding,
  type KnowledgeValidationFindingSeverity,
  KNOWLEDGE_VALIDATION_FINDING_SEVERITIES,
} from "./domain/knowledge-validation-finding.js";
export type { KnowledgeValidationReport } from "./domain/knowledge-validation-report.js";
export type { KnowledgeValidationResultMetadata } from "./domain/knowledge-validation-result-metadata.js";
export type { KnowledgeValidationAudit } from "./domain/knowledge-validation-audit.js";
export type { KnowledgeValidationLogEntry } from "./domain/knowledge-validation-log-entry.js";
export type { KnowledgeValidationHistoryEntry } from "./domain/knowledge-validation-history-entry.js";
export type { KnowledgeValidationExecution } from "./domain/knowledge-validation-execution.js";

/* ---- Contracts ---- */
export type { IKnowledgeValidation } from "./contracts/i-knowledge-validation.js";
export type {
  IKnowledgeValidatorStage,
  KnowledgeValidatorValidationInput,
  ValidatorStageIssue,
  ValidatorStageResult,
} from "./contracts/i-knowledge-validator-validator.js";
export type {
  CreateValidationInput,
  ValidationTokenInput,
  DecisionInput,
  ApproveValidationInput,
  RejectValidationInput,
  OpenValidatorSessionInput,
  ValidatorSessionTokenInput,
  CreateValidationJobInput,
  CreateValidationJobResult,
  ValidationJobTokenInput,
  FailValidationJobInput,
  RecordFindingInput,
  GenerateReportInput,
  GenerateReportResult,
  ListValidationsResult,
} from "./contracts/i-knowledge-validator-operations.js";
export type {
  IKnowledgeValidationProvider,
  KnowledgeValidationProviderFindingInput,
  KnowledgeValidationProviderResult,
} from "./contracts/i-knowledge-validation-provider.js";
export type { IKnowledgeValidationRuleProvider } from "./contracts/i-knowledge-validation-rule-provider.js";
export type { IKnowledgeValidationPolicyProvider } from "./contracts/i-knowledge-validation-policy-provider.js";
export type {
  IKnowledgeValidationDecisionProvider,
  KnowledgeValidationDecisionInput,
} from "./contracts/i-knowledge-validation-decision-provider.js";
export type { IKnowledgeValidationAuditProvider } from "./contracts/i-knowledge-validation-audit-provider.js";
export type { IKnowledgeValidationStorage } from "./contracts/i-knowledge-validation-storage.js";
export type { IKnowledgeValidationPublisher } from "./contracts/i-knowledge-validation-publisher.js";
export type { IKnowledgeValidationScheduler } from "./contracts/i-knowledge-validation-scheduler.js";
export type { IKnowledgeValidationReporter } from "./contracts/i-knowledge-validation-reporter.js";
export type { IKnowledgeValidationCostProvider } from "./contracts/i-knowledge-validation-cost-provider.js";
export type { IKnowledgeValidationStreamingProvider } from "./contracts/i-knowledge-validation-streaming-provider.js";
export type { IKnowledgeValidationMetricsProvider } from "./contracts/i-knowledge-validation-metrics-provider.js";
export type { IEmbeddingManagerValidator } from "./contracts/i-embedding-manager-validator.js";
export type { IKnowledgeGraphValidator } from "./contracts/i-knowledge-graph-validator.js";

/* ---- Errors ---- */
export { KnowledgeValidatorException } from "./errors/knowledge-validator-exception.js";
export { ValidatorNotFoundException } from "./errors/validator-not-found-exception.js";
export { DuplicateValidatorEntryException } from "./errors/duplicate-validator-entry-exception.js";
export { IllegalValidationTransitionException } from "./errors/illegal-validation-transition-exception.js";
export { InvalidValidationMetadataException } from "./errors/invalid-validation-metadata-exception.js";
export { ValidationCheckException } from "./errors/validation-check-exception.js";
export { ValidatorOperationException } from "./errors/validator-operation-exception.js";
export { ValidatorConfigurationException } from "./errors/validator-configuration-exception.js";
export { ValidatorSessionException } from "./errors/validator-session-exception.js";
export { ValidatorLeaseException } from "./errors/validator-lease-exception.js";
export { ValidatorPolicyException } from "./errors/validator-policy-exception.js";
export { ValidatorRuleException } from "./errors/validator-rule-exception.js";
export { ValidatorDecisionException } from "./errors/validator-decision-exception.js";
export { ValidatorFindingException } from "./errors/validator-finding-exception.js";

/* ---- Events ---- */
export { KnowledgeValidatorEventType } from "./events/knowledge-validator-event-type.js";
export { KnowledgeValidatorEvents } from "./events/knowledge-validator-events.js";

/* ---- Factory ---- */
export { KnowledgeValidatorFactory } from "./factory/knowledge-validator-factory.js";

/* ---- Validation (Public API façade) ---- */
export { KnowledgeValidator } from "./validation/knowledge-validator.js";

/* ---- Health ---- */
export { KnowledgeValidatorHealth } from "./health/knowledge-validator-health.js";
export type {
  HealthStatus,
  ComponentHealth,
  KnowledgeValidatorHealthReport,
} from "./health/i-health-check.js";

/* ---- Lifecycle ---- */
export { KnowledgeValidatorLifecycle } from "./lifecycle/knowledge-validator-lifecycle.js";

/* ---- Manager ---- */
export { KnowledgeValidatorManager } from "./manager/knowledge-validator-manager.js";

/* ---- Metrics ---- */
export { KnowledgeValidatorMetrics } from "./metrics/knowledge-validator-metrics.js";
export type {
  IKnowledgeValidatorMetricsCollector,
  KnowledgeValidatorMetricsSnapshot,
} from "./metrics/i-knowledge-validator-metrics-collector.js";

/* ---- Middleware ---- */
export {
  KnowledgeValidatorMiddleware,
  type ValidatorMiddleware,
  type ValidatorMiddlewareNext,
} from "./middleware/knowledge-validator-middleware.js";

/* ---- Monitoring ---- */
export {
  KnowledgeValidatorMonitoring,
  type KnowledgeValidatorDashboard,
} from "./monitoring/knowledge-validator-monitoring.js";

/* ---- Pipeline ---- */
export {
  KnowledgeValidatorPipeline,
  type RunValidatorPipelineInput,
} from "./pipeline/knowledge-validator-pipeline.js";

/* ---- Registry ---- */
export { KnowledgeValidatorRegistry } from "./registry/knowledge-validator-registry.js";
export { KnowledgeValidatorRegistryBucket } from "./registry/knowledge-validator-registry-bucket.js";
export type { KnowledgeValidatorRegistryEntry } from "./registry/knowledge-validator-registry-entry.js";

/* ---- Resolver ---- */
export { KnowledgeValidatorResolver } from "./resolver/knowledge-validator-resolver.js";

/* ---- Session ---- */
export { KnowledgeValidatorSession } from "./session/knowledge-validator-session.js";
export type { KnowledgeValidatorSessionRecord } from "./session/knowledge-validator-session-record.js";

/* ---- State Machine ---- */
export { KnowledgeValidatorStateMachine } from "./state-machine/knowledge-validator-state-machine.js";

/* ---- Statistics ---- */
export { KnowledgeValidatorStatistics } from "./statistics/knowledge-validator-statistics.js";

/* ---- Token ---- */
export {
  generateKnowledgeValidatorToken,
  isKnowledgeValidatorToken,
} from "./token/knowledge-validator-token.js";

/* ---- Validator ---- */
export { KnowledgeValidatorValidator } from "./validator/knowledge-validator-validator.js";
export { IdentityValidator } from "./validator/identity-validator.js";
export { MetadataValidator } from "./validator/metadata-validator.js";
export { ValidationValidator } from "./validator/validation-validator.js";
export { RuleValidator } from "./validator/rule-validator.js";
export { PolicyValidator } from "./validator/policy-validator.js";
export { DecisionValidator } from "./validator/decision-validator.js";
export { ConfigurationValidator } from "./validator/configuration-validator.js";
export { LifecycleValidator } from "./validator/lifecycle-validator.js";
export { DependencyValidator } from "./validator/dependency-validator.js";
export { StatisticsValidator } from "./validator/statistics-validator.js";
export { IntegrityValidator } from "./validator/integrity-validator.js";
export { AuditValidator } from "./validator/audit-validator.js";
