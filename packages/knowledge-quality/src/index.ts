/**
 * "PUBLIC API: KnowledgeQuality, KnowledgeQualityManager, KnowledgeQualityRegistry,
 * KnowledgeQualityResolver, KnowledgeQualityValidator, KnowledgeQualityPipeline,
 * KnowledgeQualityMiddleware, KnowledgeQualityFactory, KnowledgeQualityContext,
 * KnowledgeQualitySession, KnowledgeQualityLifecycle, KnowledgeQualityStateMachine,
 * KnowledgeQualityEvents, KnowledgeQualityMetrics, KnowledgeQualityHealth,
 * KnowledgeQualityMonitoring, KnowledgeQualityStatistics, KnowledgeQualitySystem."
 * (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md). The 18 named exports below, plus the full
 * Domain/Contracts/Errors/Validator-stage surface a caller needs to actually build and
 * use them — matching the curation approach established by `@aos/knowledge-marketplace`
 * and `@aos/knowledge-generator`. `KnowledgeQuality` is the façade
 * (`quality/knowledge-quality.ts`); the read-only per-assessment domain view it returns
 * is exported separately as `KnowledgeQualityAssessmentRecord`
 * (`domain/knowledge-quality-assessment-record.ts`) to avoid a same-name collision.
 */

/* ---- Bootstrap ---- */
export { KnowledgeQualitySystem } from "./bootstrap/knowledge-quality-system.js";

/* ---- Config ---- */
export type { KnowledgeQualityConfig } from "./config/knowledge-quality-config.js";

/* ---- Context ---- */
export {
  createKnowledgeQualityContext,
  type CreateKnowledgeQualityContextInput,
} from "./context/create-knowledge-quality-context.js";
export { type KnowledgeQualityContext } from "./context/knowledge-quality-context.js";

/* ---- Domain ---- */
export { KnowledgeQualityAssessmentRecord } from "./domain/knowledge-quality-assessment-record.js";
export {
  KnowledgeQualityAssessmentState,
  KNOWLEDGE_QUALITY_ASSESSMENT_STATE_TRANSITIONS,
  KNOWLEDGE_QUALITY_ASSESSMENT_TERMINAL_STATES,
  KNOWLEDGE_QUALITY_ASSESSMENT_SETTLED_STATES,
} from "./domain/knowledge-quality-assessment-state.js";
export { KnowledgeQualityDimension } from "./domain/knowledge-quality-dimension.js";
export { KnowledgeQualityAssessmentMode } from "./domain/knowledge-quality-assessment-mode.js";
export { KnowledgeQualitySessionState } from "./domain/knowledge-quality-session-state.js";
export {
  evaluateKnowledgeQualityPolicy,
  type KnowledgeQualityPolicyEvaluationInput,
  type KnowledgeQualityPolicyEvaluationResult,
} from "./domain/knowledge-quality-policy.js";
export { EMPTY_KNOWLEDGE_QUALITY_ASSESSMENT_STATISTICS } from "./domain/knowledge-quality-assessment-statistics-snapshot.js";
export type { KnowledgeQualityAssessmentStatisticsSnapshot } from "./domain/knowledge-quality-assessment-statistics-snapshot.js";
export type { KnowledgeQualityAssessment } from "./domain/knowledge-quality-assessment.js";
export type { KnowledgeQualityAssessmentJob } from "./domain/knowledge-quality-assessment-job.js";
export type { KnowledgeQualityAssessmentSession } from "./domain/knowledge-quality-assessment-session.js";
export type { KnowledgeQualityAssessmentRequest } from "./domain/knowledge-quality-assessment-request.js";
export type { KnowledgeQualityAssessmentMetadata } from "./domain/knowledge-quality-assessment-metadata.js";
export type { KnowledgeQualityConfiguration } from "./domain/knowledge-quality-configuration.js";
export type { KnowledgeQualityPolicy } from "./domain/knowledge-quality-policy.js";
export type { KnowledgeQualityProfile } from "./domain/knowledge-quality-profile.js";
export type { KnowledgeQualityRule } from "./domain/knowledge-quality-rule.js";
export {
  type KnowledgeQualityFinding,
  type KnowledgeQualityFindingSeverity,
  KNOWLEDGE_QUALITY_FINDING_SEVERITIES,
} from "./domain/knowledge-quality-finding.js";
export type { KnowledgeQualityReport } from "./domain/knowledge-quality-report.js";
export type { KnowledgeQualityScoreMetadata } from "./domain/knowledge-quality-score-metadata.js";
export type { KnowledgeQualityAssessmentAudit } from "./domain/knowledge-quality-assessment-audit.js";
export type { KnowledgeQualityAssessmentLogEntry } from "./domain/knowledge-quality-assessment-log-entry.js";
export type { KnowledgeQualityAssessmentHistoryEntry } from "./domain/knowledge-quality-assessment-history-entry.js";
export type { KnowledgeQualityExecution } from "./domain/knowledge-quality-execution.js";

/* ---- Contracts ---- */
export type { IKnowledgeQuality } from "./contracts/i-knowledge-quality.js";
export type {
  IKnowledgeQualityValidator,
  KnowledgeQualityValidationInput,
  QualityValidationIssue,
  QualityValidationResult,
} from "./contracts/i-knowledge-quality-validator.js";
export type {
  CreateAssessmentInput,
  AssessmentTokenInput,
  FailAssessmentInput,
  CompleteAssessmentInput,
  OpenQualitySessionInput,
  QualitySessionTokenInput,
  CreateAssessmentJobInput,
  CreateAssessmentJobResult,
  AssessmentJobTokenInput,
  FailAssessmentJobInput,
  RecordFindingInput,
  GenerateReportInput,
  GenerateReportResult,
  ListAssessmentsResult,
} from "./contracts/i-knowledge-quality-operations.js";
export type {
  IKnowledgeQualityProvider,
  KnowledgeQualityProviderFindingInput,
  KnowledgeQualityProviderResult,
} from "./contracts/i-knowledge-quality-provider.js";
export type { IKnowledgeQualityRuleProvider } from "./contracts/i-knowledge-quality-rule-provider.js";
export type { IKnowledgeQualityPolicyProvider } from "./contracts/i-knowledge-quality-policy-provider.js";
export type {
  IKnowledgeQualityScoringProvider,
  KnowledgeQualityScoreInput,
} from "./contracts/i-knowledge-quality-scoring-provider.js";
export type { IKnowledgeQualityAuditProvider } from "./contracts/i-knowledge-quality-audit-provider.js";
export type { IKnowledgeQualityStorage } from "./contracts/i-knowledge-quality-storage.js";
export type { IKnowledgeQualityPublisher } from "./contracts/i-knowledge-quality-publisher.js";
export type { IKnowledgeQualityScheduler } from "./contracts/i-knowledge-quality-scheduler.js";
export type { IKnowledgeQualityReporter } from "./contracts/i-knowledge-quality-reporter.js";
export type { IKnowledgeQualityCostProvider } from "./contracts/i-knowledge-quality-cost-provider.js";
export type { IKnowledgeQualityStreamingProvider } from "./contracts/i-knowledge-quality-streaming-provider.js";
export type { IKnowledgeQualityMetricsProvider } from "./contracts/i-knowledge-quality-metrics-provider.js";
export type { IKnowledgeValidatorAiQuality } from "./contracts/i-knowledge-validator-ai-quality.js";
export type { IEmbeddingManagerQuality } from "./contracts/i-embedding-manager-quality.js";

/* ---- Errors ---- */
export { KnowledgeQualityException } from "./errors/knowledge-quality-exception.js";
export { QualityNotFoundException } from "./errors/quality-not-found-exception.js";
export { DuplicateQualityEntryException } from "./errors/duplicate-quality-entry-exception.js";
export { IllegalAssessmentTransitionException } from "./errors/illegal-assessment-transition-exception.js";
export { InvalidAssessmentMetadataException } from "./errors/invalid-assessment-metadata-exception.js";
export { AssessmentValidationException } from "./errors/assessment-validation-exception.js";
export { QualityOperationException } from "./errors/quality-operation-exception.js";
export { QualityConfigurationException } from "./errors/quality-configuration-exception.js";
export { QualitySessionException } from "./errors/quality-session-exception.js";
export { QualityLeaseException } from "./errors/quality-lease-exception.js";
export { QualityPolicyException } from "./errors/quality-policy-exception.js";
export { QualityRuleException } from "./errors/quality-rule-exception.js";
export { QualityProfileException } from "./errors/quality-profile-exception.js";
export { QualityFindingException } from "./errors/quality-finding-exception.js";

/* ---- Events ---- */
export { KnowledgeQualityEventType } from "./events/knowledge-quality-event-type.js";
export { KnowledgeQualityEvents } from "./events/knowledge-quality-events.js";

/* ---- Factory ---- */
export { KnowledgeQualityFactory } from "./factory/knowledge-quality-factory.js";

/* ---- Quality (Public API façade) ---- */
export { KnowledgeQuality } from "./quality/knowledge-quality.js";

/* ---- Health ---- */
export { KnowledgeQualityHealth } from "./health/knowledge-quality-health.js";
export type {
  HealthStatus,
  ComponentHealth,
  KnowledgeQualityHealthReport,
} from "./health/i-health-check.js";

/* ---- Lifecycle ---- */
export { KnowledgeQualityLifecycle } from "./lifecycle/knowledge-quality-lifecycle.js";

/* ---- Manager ---- */
export { KnowledgeQualityManager } from "./manager/knowledge-quality-manager.js";

/* ---- Metrics ---- */
export { KnowledgeQualityMetrics } from "./metrics/knowledge-quality-metrics.js";
export type {
  IKnowledgeQualityMetricsCollector,
  KnowledgeQualityMetricsSnapshot,
} from "./metrics/i-knowledge-quality-metrics-collector.js";

/* ---- Middleware ---- */
export {
  KnowledgeQualityMiddleware,
  type QualityMiddleware,
  type QualityMiddlewareNext,
} from "./middleware/knowledge-quality-middleware.js";

/* ---- Monitoring ---- */
export {
  KnowledgeQualityMonitoring,
  type KnowledgeQualityDashboard,
} from "./monitoring/knowledge-quality-monitoring.js";

/* ---- Pipeline ---- */
export {
  KnowledgeQualityPipeline,
  type RunQualityPipelineInput,
} from "./pipeline/knowledge-quality-pipeline.js";

/* ---- Registry ---- */
export { KnowledgeQualityRegistry } from "./registry/knowledge-quality-registry.js";
export { KnowledgeQualityRegistryBucket } from "./registry/knowledge-quality-registry-bucket.js";
export type { KnowledgeQualityRegistryEntry } from "./registry/knowledge-quality-registry-entry.js";

/* ---- Resolver ---- */
export { KnowledgeQualityResolver } from "./resolver/knowledge-quality-resolver.js";

/* ---- Session ---- */
export { KnowledgeQualitySession } from "./session/knowledge-quality-session.js";
export type { KnowledgeQualitySessionRecord } from "./session/knowledge-quality-session-record.js";

/* ---- State Machine ---- */
export { KnowledgeQualityStateMachine } from "./state-machine/knowledge-quality-state-machine.js";

/* ---- Statistics ---- */
export { KnowledgeQualityStatistics } from "./statistics/knowledge-quality-statistics.js";

/* ---- Token ---- */
export {
  generateKnowledgeQualityToken,
  isKnowledgeQualityToken,
} from "./token/knowledge-quality-token.js";

/* ---- Validator ---- */
export { KnowledgeQualityValidator } from "./validator/knowledge-quality-validator.js";
export { IdentityValidator } from "./validator/identity-validator.js";
export { MetadataValidator } from "./validator/metadata-validator.js";
export { AssessmentValidator } from "./validator/assessment-validator.js";
export { RuleValidator } from "./validator/rule-validator.js";
export { ProfileValidator } from "./validator/profile-validator.js";
export { PolicyValidator } from "./validator/policy-validator.js";
export { ConfigurationValidator } from "./validator/configuration-validator.js";
export { LifecycleValidator } from "./validator/lifecycle-validator.js";
export { DependencyValidator } from "./validator/dependency-validator.js";
export { StatisticsValidator } from "./validator/statistics-validator.js";
export { IntegrityValidator } from "./validator/integrity-validator.js";
export { AuditValidator } from "./validator/audit-validator.js";
