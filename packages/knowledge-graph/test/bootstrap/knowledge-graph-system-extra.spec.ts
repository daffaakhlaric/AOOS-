import { describe, expect, it } from "vitest";

import { KnowledgeGraphSystem } from "../../src/bootstrap/knowledge-graph-system.js";
import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import { InMemoryEventPublisher } from "../../src/events/in-memory-event-publisher.js";

describe("KnowledgeGraphSystem — additional coverage", () => {
  it("multiple start()/stop() calls are idempotent", () => {
    const system = new KnowledgeGraphSystem();
    system.start();
    system.start();
    expect(system.isStarted()).toBe(true);
    system.stop();
    system.stop();
    expect(system.isStarted()).toBe(false);
  });

  it("the wrapped facade shares state across calls (same underlying context)", () => {
    const system = new KnowledgeGraphSystem();
    const graph = system.facade.graphs.createGraph({ name: "G1" });
    system.facade.graphs.createNode(graph.id, { type: KnowledgeNodeType.Agent, label: "n1" });
    expect(system.facade.graphs.findNodes(graph.id)).toHaveLength(1);
  });

  it("accepts a custom event publisher through options", () => {
    const publisher = new InMemoryEventPublisher();
    const system = new KnowledgeGraphSystem({ eventPublisher: publisher });
    system.facade.graphs.createGraph({ name: "G1" });
    expect(publisher.getHistory().length).toBeGreaterThan(0);
  });

  it("id is stable across instances", () => {
    const a = new KnowledgeGraphSystem();
    const b = new KnowledgeGraphSystem();
    expect(a.id).toBe(b.id);
  });
});
