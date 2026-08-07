/** The 10 supported report types (spec "Reports"). */
export enum KnowledgeUpdateReportType {
  UpdateSummary = "update_summary",
  SchedulerReport = "scheduler_report",
  RetryReport = "retry_report",
  ConflictReport = "conflict_report",
  RefreshReport = "refresh_report",
  PolicyReport = "policy_report",
  DependencyReport = "dependency_report",
  ValidationReport = "validation_report",
  StatisticsReport = "statistics_report",
  SessionReport = "session_report",
}

export const ALL_REPORT_TYPES: readonly KnowledgeUpdateReportType[] =
  Object.values(KnowledgeUpdateReportType);
