import { describe, expect, it } from "vitest";

import { KnowledgeUpdateSessionFactory } from "../../src/factories/knowledge-update-session-factory.js";

describe("KnowledgeUpdateSessionFactory", () => {
  it("creates an empty session at the given time", () => {
    const session = new KnowledgeUpdateSessionFactory().create(200);
    expect(session.taskIds).toEqual([]);
    expect(session.resultIds).toEqual([]);
    expect(session.startedAt).toBe(200);
    expect(session.completedAt).toBeUndefined();
  });

  it("generates unique ids across calls", () => {
    const factory = new KnowledgeUpdateSessionFactory();
    const a = factory.create(0);
    const b = factory.create(0);
    expect(a.id).not.toBe(b.id);
  });
});
