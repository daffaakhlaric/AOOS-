import { describe, expect, it } from "vitest";

import * as PublicApi from "../src/index.js";

const EXPECTED_TOP_LEVEL_EXPORTS = [
  "KnowledgeGraph",
  "KnowledgeGraphSystem",
  "createKnowledgeGraphSystem",
  "KnowledgeGraphManager",
  "RelationshipManager",
  "TraversalManager",
  "AnalyticsManager",
  "ReasoningManager",
  "createGraphSystemContext",
  "GraphRegistry",
  "NodeRegistry",
  "EdgeRegistry",
  "RelationshipRegistry",
  "SnapshotRegistry",
  "ConfigurationRegistry",
  "DEFAULT_CONFIGURATION_KEY",
  "GraphFactory",
  "GraphSnapshotFactory",
  "KnowledgeNodeFactory",
  "KnowledgeEdgeFactory",
  "KnowledgeGraphEventType",
  "InMemoryEventPublisher",
  "NoOpEventPublisher",
  "KnowledgeGraphMetricsCollector",
  "KnowledgeGraphMonitor",
  "GraphStatisticsService",
  "ConfigurationService",
  "LoggingMiddleware",
  "TimingMiddleware",
  "PermissiveAuthorizationChecker",
  "KnowledgeNodeType",
  "isKnowledgeNodeType",
  "KnowledgeEdgeType",
  "isKnowledgeEdgeType",
  "GraphEngine",
  "executeGraphQuery",
  "GraphOperationType",
  "KnowledgeGraphException",
  "GraphNotFoundException",
  "NodeNotFoundException",
  "EdgeNotFoundException",
  "SnapshotNotFoundException",
  "DuplicateEntryException",
  "GraphValidationException",
  "GraphAuthorizationException",
  "RelationshipValidationException",
  "CycleDetectedException",
  "GraphConfigurationException",
];

describe("public API", () => {
  it.each(EXPECTED_TOP_LEVEL_EXPORTS)("exports %s", (name) => {
    expect(Reflect.has(PublicApi, name)).toBe(true);
    expect((PublicApi as Record<string, unknown>)[name]).toBeDefined();
  });

  it("does NOT export internal pipeline-stage functions", () => {
    expect(Reflect.has(PublicApi, "runValidationStage")).toBe(false);
    expect(Reflect.has(PublicApi, "runAuthorizationStage")).toBe(false);
    expect(Reflect.has(PublicApi, "runRelationshipValidationStage")).toBe(false);
    expect(Reflect.has(PublicApi, "runCycleDetectionStage")).toBe(false);
    expect(Reflect.has(PublicApi, "runExecutionStage")).toBe(false);
    expect(Reflect.has(PublicApi, "runMetricsStage")).toBe(false);
    expect(Reflect.has(PublicApi, "runEventsStage")).toBe(false);
  });

  it("does NOT export GraphOperationPipeline itself (internal wiring)", () => {
    expect(Reflect.has(PublicApi, "GraphOperationPipeline")).toBe(false);
  });

  it("KnowledgeNodeType has 18 members", () => {
    expect(Object.values(PublicApi.KnowledgeNodeType)).toHaveLength(18);
  });

  it("KnowledgeEdgeType has 20 members", () => {
    expect(Object.values(PublicApi.KnowledgeEdgeType)).toHaveLength(20);
  });

  it("KnowledgeGraphEventType has 13 members", () => {
    expect(Object.keys(PublicApi.KnowledgeGraphEventType)).toHaveLength(13);
  });

  it("the facade supports a minimal end-to-end flow via only the public API", () => {
    const kg = new PublicApi.KnowledgeGraph();
    const graph = kg.graphs.createGraph({ name: "G1" });
    expect(graph.name).toBe("G1");
  });
});
