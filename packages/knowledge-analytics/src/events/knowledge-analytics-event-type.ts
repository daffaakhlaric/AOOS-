/**
 * The 6 domain events from the specification. Dotted, namespaced convention:
 * `knowledge.analytics.<subject>` (mirrors the AOS platform-wide event naming convention observed
 * across sibling packages, e.g. `@aos/knowledge-graph`'s `knowledge.graph.*`).
 */
export enum KnowledgeAnalyticsEventType {
  AnalyticsStarted = "knowledge.analytics.started",
  AnalyticsCompleted = "knowledge.analytics.completed",
  AnalyticsFailed = "knowledge.analytics.failed",
  MetricCalculated = "knowledge.analytics.metric.calculated",
  ReportGenerated = "knowledge.analytics.report.generated",
  DashboardUpdated = "knowledge.analytics.dashboard.updated",
}
