/**
 * "PUBLIC API: KnowledgePolicy, KnowledgePolicyManager, KnowledgePolicyRegistry,
 * KnowledgePolicyResolver, KnowledgePolicyValidator, KnowledgePolicyPipeline,
 * KnowledgePolicyMiddleware, KnowledgePolicyFactory, KnowledgePolicyContext,
 * KnowledgePolicySession, KnowledgePolicyLifecycle, KnowledgePolicyStateMachine,
 * KnowledgePolicyEvents, KnowledgePolicyMetrics, KnowledgePolicyHealth,
 * KnowledgePolicyMonitoring, KnowledgePolicyStatistics, KnowledgePolicySystem."
 * (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md). The 18 named exports below, plus the full
 * Domain/Contracts/Errors/Validator-stage surface a caller needs to actually build and
 * use them — matching the curation approach established by `@aos/knowledge-versioning`/
 * `@aos/knowledge-provider`. `KnowledgePolicy` is the façade (`policy/knowledge-policy.ts`);
 * the read-only per-policy domain view it returns is exported separately as
 * `KnowledgePolicyRecord` (`domain/knowledge-policy-record.ts`) to avoid a same-name
 * collision — this package's Public API list, unlike `@aos/knowledge-versioning`'s (which
 * has both `KnowledgeVersioning` and `KnowledgeVersion`), names only one `KnowledgePolicy`.
 */

/* ---- Bootstrap ---- */
export { KnowledgePolicySystem } from "./bootstrap/knowledge-policy-system.js";

/* ---- Config ---- */
export type { KnowledgePolicyConfig } from "./config/knowledge-policy-config.js";

/* ---- Context ---- */
export {
  createKnowledgePolicyContext,
  type CreateKnowledgePolicyContextInput,
} from "./context/create-knowledge-policy-context.js";
export { type KnowledgePolicyContext } from "./context/knowledge-policy-context.js";

/* ---- Domain ---- */
export { KnowledgePolicyRecord } from "./domain/knowledge-policy-record.js";
export { KnowledgePolicyHistory } from "./domain/knowledge-policy-history.js";
export {
  KnowledgePolicyState,
  KNOWLEDGE_POLICY_STATE_TRANSITIONS,
  KNOWLEDGE_POLICY_TERMINAL_STATES,
  KNOWLEDGE_POLICY_SETTLED_STATES,
} from "./domain/knowledge-policy-state.js";
export { KnowledgePolicyType } from "./domain/knowledge-policy-type.js";
export { KnowledgePolicyScopeType } from "./domain/knowledge-policy-scope-type.js";
export { KnowledgePolicyRuleType } from "./domain/knowledge-policy-rule-type.js";
export { KnowledgePolicyOperation } from "./domain/knowledge-policy-operation.js";
export { KnowledgePolicyEvaluationResult } from "./domain/knowledge-policy-evaluation.js";
export { EMPTY_KNOWLEDGE_POLICY_STATISTICS } from "./domain/knowledge-policy-statistics-snapshot.js";
export type { KnowledgePolicyMetadata } from "./domain/knowledge-policy-metadata.js";
export type { KnowledgePolicyInstance } from "./domain/knowledge-policy-instance.js";
export type { KnowledgePolicyRule } from "./domain/knowledge-policy-rule.js";
export type { KnowledgePolicyScope } from "./domain/knowledge-policy-scope.js";
export type { KnowledgePolicyCondition } from "./domain/knowledge-policy-condition.js";
export type { KnowledgePolicyAction } from "./domain/knowledge-policy-action.js";
export type { KnowledgePolicyAssignment } from "./domain/knowledge-policy-assignment.js";
export type {
  KnowledgePolicyEvaluation,
  KnowledgePolicyViolation,
} from "./domain/knowledge-policy-evaluation.js";
export type { KnowledgePolicyAuditEntry } from "./domain/knowledge-policy-audit.js";
export type { KnowledgePolicyConfigurationRecord } from "./domain/knowledge-policy-configuration-record.js";
export type { KnowledgePolicyLogEntry } from "./domain/knowledge-policy-log.js";
export type { KnowledgePolicyTrace } from "./domain/knowledge-policy-trace.js";
export type { KnowledgePolicyStatisticsSnapshot } from "./domain/knowledge-policy-statistics-snapshot.js";
export type {
  KnowledgePolicyExecution,
  KnowledgePolicyHistoryEntry,
} from "./domain/knowledge-policy-execution.js";
export type { KnowledgePolicyPermissionGrant } from "./domain/knowledge-policy-permission-grant.js";

/* ---- Contracts ---- */
export type { IKnowledgePolicy } from "./contracts/i-knowledge-policy.js";
export type {
  IKnowledgePolicyValidator,
  KnowledgePolicyValidationInput,
  KnowledgePolicyValidationIssue,
  KnowledgePolicyValidationResult,
} from "./contracts/i-knowledge-policy-validator.js";
export type {
  ActivatePolicyInput,
  ArchivePolicyInput,
  AssignPolicyInput,
  AssignPolicyResult,
  CreatePolicyInput,
  DestroyPolicyInput,
  EvaluatePolicyInput,
  EvaluatePolicyResult,
  RestorePolicyInput,
  SuspendPolicyInput,
  UnassignPolicyInput,
  ValidatePolicyInput,
} from "./contracts/i-knowledge-policy-operations.js";

/* ---- Errors ---- */
export { KnowledgePolicyException } from "./errors/knowledge-policy-exception.js";
export { DuplicatePolicyEntryException } from "./errors/duplicate-policy-entry-exception.js";
export { IllegalPolicyTransitionException } from "./errors/illegal-policy-transition-exception.js";
export { InvalidPolicyMetadataException } from "./errors/invalid-policy-metadata-exception.js";
export { PolicyNotFoundException } from "./errors/policy-not-found-exception.js";
export { PolicyOperationException } from "./errors/policy-operation-exception.js";
export { PolicyPermissionDeniedException } from "./errors/policy-permission-denied-exception.js";
export { PolicyValidationException } from "./errors/policy-validation-exception.js";
export { PolicyViolationException } from "./errors/policy-violation-exception.js";
export { PolicyConfigurationException } from "./errors/policy-configuration-exception.js";
export { PolicySessionException } from "./errors/policy-session-exception.js";
export { PolicyLeaseException } from "./errors/policy-lease-exception.js";
export { PolicyAssignmentException } from "./errors/policy-assignment-exception.js";
export { PolicyEvaluationException } from "./errors/policy-evaluation-exception.js";
export { PolicyRuleException } from "./errors/policy-rule-exception.js";

/* ---- Events ---- */
export { KnowledgePolicyEventType } from "./events/knowledge-policy-event-type.js";
export { KnowledgePolicyEvents } from "./events/knowledge-policy-events.js";

/* ---- Factory ---- */
export { KnowledgePolicyFactory } from "./factory/knowledge-policy-factory.js";

/* ---- Health ---- */
export { KnowledgePolicyHealth } from "./health/knowledge-policy-health.js";
export type {
  HealthStatus,
  ComponentHealth,
  KnowledgePolicyHealthReport,
} from "./health/i-health-check.js";

/* ---- Lifecycle ---- */
export { KnowledgePolicyLifecycle } from "./lifecycle/knowledge-policy-lifecycle.js";

/* ---- Manager ---- */
export { KnowledgePolicyManager } from "./manager/knowledge-policy-manager.js";

/* ---- Metrics ---- */
export { KnowledgePolicyMetrics } from "./metrics/knowledge-policy-metrics.js";
export type {
  IKnowledgePolicyMetricsCollector,
  KnowledgePolicyMetricsSnapshot,
} from "./metrics/i-knowledge-policy-metrics-collector.js";

/* ---- Middleware ---- */
export {
  KnowledgePolicyMiddleware,
  type PolicyMiddleware,
  type PolicyMiddlewareNext,
} from "./middleware/knowledge-policy-middleware.js";

/* ---- Monitoring ---- */
export {
  KnowledgePolicyMonitoring,
  type KnowledgePolicyDashboard,
} from "./monitoring/knowledge-policy-monitoring.js";

/* ---- Pipeline ---- */
export {
  KnowledgePolicyPipeline,
  type RunPolicyPipelineInput,
} from "./pipeline/knowledge-policy-pipeline.js";

/* ---- Policy (Public API façade) ---- */
export { KnowledgePolicy } from "./policy/knowledge-policy.js";
export { KnowledgePolicyPermission } from "./policy/knowledge-policy-permission.js";
export { KnowledgePolicyConfiguration } from "./policy/knowledge-policy-configuration.js";

/* ---- Registry ---- */
export { KnowledgePolicyRegistry } from "./registry/knowledge-policy-registry.js";
export { KnowledgePolicyRegistryBucket } from "./registry/knowledge-policy-registry-bucket.js";
export type { PolicyRegistryEntry } from "./registry/policy-registry-entry.js";

/* ---- Resolver ---- */
export { KnowledgePolicyResolver } from "./resolver/knowledge-policy-resolver.js";

/* ---- Session ---- */
export { KnowledgePolicySession } from "./session/knowledge-policy-session.js";
export { KnowledgePolicySessionState } from "./session/knowledge-policy-session-state.js";
export type { KnowledgePolicySessionRecord } from "./session/knowledge-policy-session-record.js";

/* ---- State Machine ---- */
export { KnowledgePolicyStateMachine } from "./state-machine/knowledge-policy-state-machine.js";

/* ---- Statistics ---- */
export { KnowledgePolicyStatistics } from "./statistics/knowledge-policy-statistics.js";

/* ---- Token ---- */
export {
  generateKnowledgePolicyToken,
  isKnowledgePolicyToken,
} from "./token/knowledge-policy-token.js";

/* ---- Validator ---- */
export { KnowledgePolicyValidator } from "./validator/knowledge-policy-validator.js";
export { IdentityValidator } from "./validator/identity-validator.js";
export { MetadataValidator } from "./validator/metadata-validator.js";
export { ScopeValidator } from "./validator/scope-validator.js";
export { RulesValidator } from "./validator/rules-validator.js";
export { ConditionsValidator } from "./validator/conditions-validator.js";
export { AssignmentValidator } from "./validator/assignment-validator.js";
export { PolicyTypeValidator } from "./validator/policy-type-validator.js";
export { ConfigurationValidator } from "./validator/configuration-validator.js";
export { DependencyValidator } from "./validator/dependency-validator.js";
export { IntegrityValidator } from "./validator/integrity-validator.js";
