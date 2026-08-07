/**
 * "EVENTS: ValidationCreated, ValidationQueued, ValidationStarted, ValidationCompleted,
 * ValidationApproved, ValidationRejected, ValidationCancelled, ValidationArchived,
 * ValidationDestroyed, DecisionCreated, ReportGenerated."
 * (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md) — the exact 11 events. `Completed` fires
 * on the generic Reviewing -> (Approved|Rejected) transition, and `Approved`/`Rejected`
 * fire alongside it as the more specific event for the same transition — both are
 * published together by `approve()`/`reject()`, a documented judgment call satisfying
 * the spec's literal event list (see docs/005.7M-KNOWLEDGE-VALIDATOR-AI-REPORT.md —
 * "Events").
 */
export enum KnowledgeValidatorEventType {
  VALIDATION_CREATED = "knowledge.validation.created",
  VALIDATION_QUEUED = "knowledge.validation.queued",
  VALIDATION_STARTED = "knowledge.validation.started",
  VALIDATION_COMPLETED = "knowledge.validation.completed",
  VALIDATION_APPROVED = "knowledge.validation.approved",
  VALIDATION_REJECTED = "knowledge.validation.rejected",
  VALIDATION_CANCELLED = "knowledge.validation.cancelled",
  VALIDATION_ARCHIVED = "knowledge.validation.archived",
  VALIDATION_DESTROYED = "knowledge.validation.destroyed",
  DECISION_CREATED = "knowledge.validation.decision.created",
  REPORT_GENERATED = "knowledge.validation.report.generated",
}
