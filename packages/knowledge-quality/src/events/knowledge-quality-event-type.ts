/**
 * "EVENTS: AssessmentCreated, AssessmentQueued, AssessmentStarted, AssessmentCompleted,
 * AssessmentFailed, AssessmentCancelled, AssessmentArchived, AssessmentDestroyed,
 * FindingCreated, ReportGenerated." (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md) — the
 * exact 10 events.
 */
export enum KnowledgeQualityEventType {
  ASSESSMENT_CREATED = "knowledge.quality.assessment.created",
  ASSESSMENT_QUEUED = "knowledge.quality.assessment.queued",
  ASSESSMENT_STARTED = "knowledge.quality.assessment.started",
  ASSESSMENT_COMPLETED = "knowledge.quality.assessment.completed",
  ASSESSMENT_FAILED = "knowledge.quality.assessment.failed",
  ASSESSMENT_CANCELLED = "knowledge.quality.assessment.cancelled",
  ASSESSMENT_ARCHIVED = "knowledge.quality.assessment.archived",
  ASSESSMENT_DESTROYED = "knowledge.quality.assessment.destroyed",
  FINDING_CREATED = "knowledge.quality.finding.created",
  REPORT_GENERATED = "knowledge.quality.report.generated",
}
