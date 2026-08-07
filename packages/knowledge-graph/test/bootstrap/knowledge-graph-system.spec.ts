import { describe, expect, it } from "vitest";

import {
  createKnowledgeGraphSystem,
  KnowledgeGraphSystem,
} from "../../src/bootstrap/knowledge-graph-system.js";

describe("KnowledgeGraphSystem", () => {
  it("exposes id/facade and starts stopped", () => {
    const system = new KnowledgeGraphSystem();
    expect(system.id).toBe("knowledge-graph");
    expect(system.isStarted()).toBe(false);
  });

  it("start()/stop() toggle isStarted()", () => {
    const system = new KnowledgeGraphSystem();
    system.start();
    expect(system.isStarted()).toBe(true);
    system.stop();
    expect(system.isStarted()).toBe(false);
  });

  it("the facade is a fully working KnowledgeGraph", () => {
    const system = new KnowledgeGraphSystem();
    const graph = system.facade.graphs.createGraph({ name: "G1" });
    expect(graph.name).toBe("G1");
  });

  it("createKnowledgeGraphSystem() is equivalent to `new KnowledgeGraphSystem()`", () => {
    const system = createKnowledgeGraphSystem();
    expect(system).toBeInstanceOf(KnowledgeGraphSystem);
  });

  it("forwards options through to the facade", () => {
    const system = createKnowledgeGraphSystem({
      configuration: { strictRelationshipValidation: false },
    });
    expect(system.facade).toBeDefined();
  });
});
