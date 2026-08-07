import { describe, expect, it } from "vitest";

import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";
import { createGraphSystemContext } from "../../src/manager/graph-system-context.js";
import { GraphOperationPipeline } from "../../src/pipeline/graph-operation-pipeline.js";

describe("createGraphSystemContext", () => {
  it("wires all 6 registries, factories, and a monitor bound to the graph registry", () => {
    const ctx = createGraphSystemContext(new InMemoryEventPublisher());
    expect(ctx.graphRegistry.size).toBe(0);
    expect(ctx.nodeRegistry.size).toBe(0);
    expect(ctx.edgeRegistry.size).toBe(0);
    expect(ctx.relationshipRegistry.size).toBe(0);
    expect(ctx.snapshotRegistry.size).toBe(0);
    expect(ctx.configurationRegistry.size).toBe(0);
    expect(ctx.monitor.health().graphCount).toBe(0);
  });

  it("defaults to a fresh GraphOperationPipeline when none is supplied", () => {
    const ctx = createGraphSystemContext(new InMemoryEventPublisher());
    expect(ctx.pipeline).toBeInstanceOf(GraphOperationPipeline);
  });

  it("accepts a caller-supplied pipeline", () => {
    const pipeline = new GraphOperationPipeline();
    const ctx = createGraphSystemContext(new InMemoryEventPublisher(), pipeline);
    expect(ctx.pipeline).toBe(pipeline);
  });
});
