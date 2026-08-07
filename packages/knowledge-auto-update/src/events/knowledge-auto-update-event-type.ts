/** The 13 domain events published throughout an update's lifecycle (spec "Events"). */
export enum KnowledgeAutoUpdateEventType {
  UpdateStarted = "knowledge_auto_update.update_started",
  UpdateCompleted = "knowledge_auto_update.update_completed",
  UpdateFailed = "knowledge_auto_update.update_failed",
  UpdateRetried = "knowledge_auto_update.update_retried",
  UpdateCancelled = "knowledge_auto_update.update_cancelled",
  UpdatePaused = "knowledge_auto_update.update_paused",
  UpdateResumed = "knowledge_auto_update.update_resumed",
  UpdateScheduled = "knowledge_auto_update.update_scheduled",
  UpdateValidated = "knowledge_auto_update.update_validated",
  ConflictDetected = "knowledge_auto_update.conflict_detected",
  ConflictResolved = "knowledge_auto_update.conflict_resolved",
  KnowledgeRefreshed = "knowledge_auto_update.knowledge_refreshed",
  ReportGenerated = "knowledge_auto_update.report_generated",
}
