import { describe, expect, it } from "vitest";

import { KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";
import { KnowledgeNodeFactory } from "../../src/nodes/knowledge-node-factory.js";
import { KnowledgeNodeUpdater } from "../../src/nodes/knowledge-node-updater.js";

describe("KnowledgeNodeUpdater", () => {
  const factory = new KnowledgeNodeFactory();
  const updater = new KnowledgeNodeUpdater();

  it("updates label when supplied", () => {
    const node = factory.create({ type: KnowledgeNodeType.Agent, label: "old" });
    const updated = updater.apply(node, { label: "new" });
    expect(updated.label).toBe("new");
    expect(updated.id).toBe(node.id);
  });

  it("keeps the existing label when not supplied", () => {
    const node = factory.create({ type: KnowledgeNodeType.Agent, label: "old" });
    const updated = updater.apply(node, {});
    expect(updated.label).toBe("old");
  });

  it("updates metadata when supplied, keeps it when not", () => {
    const node = factory.create({ type: KnowledgeNodeType.Agent, label: "n", metadata: { a: 1 } });
    const updated = updater.apply(node, { metadata: { b: 2 } });
    expect(updated.metadata).toEqual({ b: 2 });
    const untouched = updater.apply(node, {});
    expect(untouched.metadata).toEqual({ a: 1 });
  });

  it("bumps updatedAt", () => {
    const node = factory.create({ type: KnowledgeNodeType.Agent, label: "n" });
    const updated = updater.apply(node, { label: "n2" });
    expect(updated.updatedAt).toBeGreaterThanOrEqual(node.updatedAt);
  });
});
