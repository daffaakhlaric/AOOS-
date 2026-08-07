import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsEngine } from "../../src/services/knowledge-analytics-engine.js";

/**
 * Generic behavior every one of the 11 analytics services must uphold, verified uniformly by
 * driving each through the engine with one representative recording.
 */
function recordOne(engine: KnowledgeAnalyticsEngine, key: string): void {
  switch (key) {
    case "usage":
      engine.usage.recordDocumentAdded(1);
      break;
    case "search":
      engine.search.recordSearch({ hit: true });
      break;
    case "retrieval":
      engine.retrieval.recordRetrieval({ cacheHit: true });
      break;
    case "query":
      engine.query.recordQueryTime(10);
      break;
    case "embedding":
      engine.embedding.recordEmbedding({ durationMs: 5, tokens: 1 });
      break;
    case "graph":
      engine.graph.recordGraphSnapshot({ nodeCount: 1, edgeCount: 0, connectedComponents: 1 });
      break;
    case "quality":
      engine.quality.recordQualityCheck({ succeeded: true });
      break;
    case "performance":
      engine.performance.recordRetrievalTime(5);
      break;
    case "trend":
      engine.trend.recordHistoricalValue("s", 1);
      break;
    case "cost":
      engine.cost.recordEmbeddingCost(1);
      break;
    case "recommendation":
      engine.recommendation.recordAccess("k");
      break;
    default:
      throw new Error(`unknown service key: ${key}`);
  }
}

const SERVICE_KEYS = [
  "usage",
  "search",
  "retrieval",
  "query",
  "embedding",
  "graph",
  "quality",
  "performance",
  "trend",
  "cost",
  "recommendation",
] as const;

describe("Every analytics service: sampleCount and reset() behave uniformly", () => {
  it.each(SERVICE_KEYS)("%s.sampleCount() is 0 before any recording", (key) => {
    const engine = new KnowledgeAnalyticsEngine();
    const service = engine[key];
    expect(service.sampleCount()).toBe(0);
  });

  it.each(SERVICE_KEYS)("%s.sampleCount() increases after one recording", (key) => {
    const engine = new KnowledgeAnalyticsEngine();
    recordOne(engine, key);
    const service = engine[key];
    expect(service.sampleCount()).toBeGreaterThan(0);
  });

  it.each(SERVICE_KEYS)("%s.reset() brings sampleCount back to 0", (key) => {
    const engine = new KnowledgeAnalyticsEngine();
    recordOne(engine, key);
    const service = engine[key];
    service.reset();
    expect(service.sampleCount()).toBe(0);
  });

  it.each(SERVICE_KEYS)("%s.summary() returns an object both before and after recording", (key) => {
    const engine = new KnowledgeAnalyticsEngine();
    const service = engine[key];
    expect(typeof service.summary()).toBe("object");
    recordOne(engine, key);
    expect(typeof service.summary()).toBe("object");
  });
});
