import { describe, expect, it } from "vitest";

import { KnowledgeMetricName } from "../../src/types/metric-name.js";

describe("KnowledgeMetricName", () => {
  it("defines exactly 30 named metrics", () => {
    expect(Object.keys(KnowledgeMetricName)).toHaveLength(30);
  });

  it("has no duplicate values", () => {
    const values = Object.values(KnowledgeMetricName);
    expect(new Set(values).size).toBe(values.length);
  });

  it("uses lower_snake_case string values", () => {
    for (const value of Object.values(KnowledgeMetricName)) {
      expect(value).toMatch(/^[a-z0-9_]+$/);
    }
  });

  it("includes every metric named in the specification", () => {
    const expected = [
      "document_count",
      "indexed_count",
      "deleted_count",
      "search_count",
      "retrieval_count",
      "hit_rate",
      "miss_rate",
      "success_rate",
      "failure_rate",
      "average_query_time",
      "p95_query_time",
      "p99_query_time",
      "embedding_time",
      "retrieval_time",
      "cache_hit",
      "cache_miss",
      "storage_usage",
      "knowledge_usage",
      "provider_usage",
      "token_usage",
      "embedding_cost",
      "query_cost",
      "most_accessed_knowledge",
      "least_accessed_knowledge",
      "graph_node_count",
      "graph_edge_count",
      "connected_components",
      "average_graph_degree",
      "trend_analysis",
      "historical_metrics",
    ];
    const values = Object.values(KnowledgeMetricName);
    for (const value of expected) expect(values).toContain(value);
  });
});
