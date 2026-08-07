/**
 * The 30 named metrics from the 005.7P specification. Grouped by owning analytics service (see
 * README "Metric Distribution" table / the Engineering Report for the full rationale).
 */
export enum KnowledgeMetricName {
  // KnowledgeUsageAnalytics
  DocumentCount = "document_count",
  IndexedCount = "indexed_count",
  DeletedCount = "deleted_count",
  StorageUsage = "storage_usage",
  KnowledgeUsage = "knowledge_usage",
  ProviderUsage = "provider_usage",

  // KnowledgeSearchAnalytics
  SearchCount = "search_count",
  HitRate = "hit_rate",
  MissRate = "miss_rate",

  // KnowledgeRetrievalAnalytics
  RetrievalCount = "retrieval_count",
  CacheHit = "cache_hit",
  CacheMiss = "cache_miss",

  // KnowledgeQueryAnalytics
  AverageQueryTime = "average_query_time",
  P95QueryTime = "p95_query_time",
  P99QueryTime = "p99_query_time",

  // KnowledgeEmbeddingAnalytics
  EmbeddingTime = "embedding_time",
  TokenUsage = "token_usage",

  // KnowledgeGraphAnalytics
  GraphNodeCount = "graph_node_count",
  GraphEdgeCount = "graph_edge_count",
  ConnectedComponents = "connected_components",
  AverageGraphDegree = "average_graph_degree",

  // KnowledgeQualityAnalytics
  SuccessRate = "success_rate",
  FailureRate = "failure_rate",

  // KnowledgePerformanceAnalytics
  RetrievalTime = "retrieval_time",

  // KnowledgeTrendAnalytics
  TrendAnalysis = "trend_analysis",
  HistoricalMetrics = "historical_metrics",

  // KnowledgeCostAnalytics
  EmbeddingCost = "embedding_cost",
  QueryCost = "query_cost",

  // KnowledgeRecommendationAnalytics
  MostAccessedKnowledge = "most_accessed_knowledge",
  LeastAccessedKnowledge = "least_accessed_knowledge",
}
