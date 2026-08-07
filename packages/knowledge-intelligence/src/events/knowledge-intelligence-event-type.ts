/** The 14 domain events published throughout an intelligence run's lifecycle (spec "Events"). */
export enum KnowledgeIntelligenceEventType {
  IntelligenceStarted = "knowledge_intelligence.intelligence_started",
  IntelligenceCompleted = "knowledge_intelligence.intelligence_completed",
  IntelligenceFailed = "knowledge_intelligence.intelligence_failed",
  KnowledgeAnalyzed = "knowledge_intelligence.knowledge_analyzed",
  InsightGenerated = "knowledge_intelligence.insight_generated",
  RecommendationGenerated = "knowledge_intelligence.recommendation_generated",
  GapDetected = "knowledge_intelligence.gap_detected",
  DuplicateDetected = "knowledge_intelligence.duplicate_detected",
  SimilarityDetected = "knowledge_intelligence.similarity_detected",
  RelationshipDiscovered = "knowledge_intelligence.relationship_discovered",
  HealthCalculated = "knowledge_intelligence.health_calculated",
  ScoreCalculated = "knowledge_intelligence.score_calculated",
  ClassificationCompleted = "knowledge_intelligence.classification_completed",
  ReportGenerated = "knowledge_intelligence.report_generated",
}
