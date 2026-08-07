import { describe, expect, it } from "vitest";

import { KnowledgeGraph } from "../../src/application/knowledge-graph-facade.js";
import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import { LoggingMiddleware } from "../../src/middleware/logging-middleware.js";
import { TimingMiddleware } from "../../src/middleware/timing-middleware.js";
import { GraphOperationType } from "../../src/pipeline/graph-operation-type.js";

describe("KnowledgeGraph facade — combined middlewares", () => {
  it("both LoggingMiddleware and TimingMiddleware observe every operation", () => {
    const logging = new LoggingMiddleware();
    const timing = new TimingMiddleware();
    const kg = new KnowledgeGraph({ middlewares: [logging, timing] });
    const graph = kg.graphs.createGraph({ name: "G1" });
    kg.graphs.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n1" });

    expect(logging.getLog().length).toBe(2);
    expect(logging.getLog().every((entry) => entry.outcome === "success")).toBe(true);
    expect(timing.sampleCount(GraphOperationType.CreateGraph)).toBe(1);
    expect(timing.sampleCount(GraphOperationType.CreateNode)).toBe(1);
  });

  it("LoggingMiddleware records a failure entry when a downstream stage throws", () => {
    const logging = new LoggingMiddleware();
    const kg = new KnowledgeGraph({ middlewares: [logging] });
    expect(() => kg.graphs.deleteGraph("missing")).toThrow();
    expect(logging.getLog().at(-1)?.outcome).toBe("failure");
  });
});
