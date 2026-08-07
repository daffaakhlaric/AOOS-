import { describe, expect, it } from "vitest";

import { KnowledgeGraph } from "../../src/application/knowledge-graph-facade.js";
import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import { GraphAuthorizationException } from "../../src/errors/graph-authorization-exception.js";
import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { LoggingMiddleware } from "../../src/middleware/logging-middleware.js";

describe("KnowledgeGraph facade", () => {
  it("wires the 5 managers and supports an end-to-end flow", () => {
    const kg = new KnowledgeGraph();
    const graph = kg.graphs.createGraph({ name: "G1" });
    const a = kg.graphs.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "A" });
    const b = kg.graphs.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "B" });
    kg.relationships.connect(graph.id, a.id, b.id, KnowledgeEdgeType.DependsOn);

    expect(kg.relationships.relationshipExists(graph.id, a.id, b.id)).toBe(true);
    expect(kg.traversal.findNeighbors(graph.id, a.id)).toEqual([b.id]);
    expect(kg.analytics.graphStatistics(graph.id).nodeCount).toBe(2);
    expect(kg.reasoning.findDependencies(graph.id, a.id)).toEqual([b.id]);
  });

  it("metrics() and monitor reflect facade activity", () => {
    const kg = new KnowledgeGraph();
    kg.graphs.createGraph({ name: "G1" });
    expect(kg.metrics().graphCount).toBe(1);
    expect(kg.monitor.health().graphCount).toBe(1);
  });

  it("accepts a custom event publisher", () => {
    const publisher = new InMemoryEventPublisher();
    const kg = new KnowledgeGraph({ eventPublisher: publisher });
    kg.graphs.createGraph({ name: "G1" });
    expect(publisher.getHistory().length).toBeGreaterThan(0);
  });

  it("accepts a custom default configuration", () => {
    const kg = new KnowledgeGraph({
      configuration: { authorizationChecker: { isAuthorized: () => false } },
    });
    expect(() => kg.graphs.createGraph({ name: "G1" })).toThrow(GraphAuthorizationException);
  });

  it("accepts pipeline middlewares", () => {
    const logging = new LoggingMiddleware();
    const kg = new KnowledgeGraph({ middlewares: [logging] });
    kg.graphs.createGraph({ name: "G1" });
    expect(logging.getLog().length).toBeGreaterThan(0);
  });
});
