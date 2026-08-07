import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { KnowledgeEdgeFactory } from "../../src/edges/knowledge-edge-factory.js";
import { KnowledgeEdgeUpdater } from "../../src/edges/knowledge-edge-updater.js";
import { GraphValidationException } from "../../src/errors/graph-validation-exception.js";

describe("KnowledgeEdgeUpdater", () => {
  const factory = new KnowledgeEdgeFactory();
  const updater = new KnowledgeEdgeUpdater();

  it("updates weight when supplied", () => {
    const edge = factory.create({
      type: KnowledgeEdgeType.Uses,
      sourceNodeId: "A",
      targetNodeId: "B",
    });
    const updated = updater.apply(edge, { weight: 9 });
    expect(updated.weight).toBe(9);
  });

  it("keeps the existing weight when not supplied", () => {
    const edge = factory.create({
      type: KnowledgeEdgeType.Uses,
      sourceNodeId: "A",
      targetNodeId: "B",
      weight: 2,
    });
    const updated = updater.apply(edge, {});
    expect(updated.weight).toBe(2);
  });

  it("updates metadata when supplied, keeps it when not", () => {
    const edge = factory.create({
      type: KnowledgeEdgeType.Uses,
      sourceNodeId: "A",
      targetNodeId: "B",
      metadata: { a: 1 },
    });
    const updated = updater.apply(edge, { metadata: { b: 2 } });
    expect(updated.metadata).toEqual({ b: 2 });
    const untouched = updater.apply(edge, {});
    expect(untouched.metadata).toEqual({ a: 1 });
  });

  it("rejects a negative weight", () => {
    const edge = factory.create({
      type: KnowledgeEdgeType.Uses,
      sourceNodeId: "A",
      targetNodeId: "B",
    });
    expect(() => updater.apply(edge, { weight: -5 })).toThrow(GraphValidationException);
  });

  it("rejects a non-finite weight", () => {
    const edge = factory.create({
      type: KnowledgeEdgeType.Uses,
      sourceNodeId: "A",
      targetNodeId: "B",
    });
    expect(() => updater.apply(edge, { weight: Number.NaN })).toThrow(GraphValidationException);
  });

  it("bumps updatedAt", () => {
    const edge = factory.create({
      type: KnowledgeEdgeType.Uses,
      sourceNodeId: "A",
      targetNodeId: "B",
    });
    const updated = updater.apply(edge, { weight: 2 });
    expect(updated.updatedAt).toBeGreaterThanOrEqual(edge.updatedAt);
  });
});
