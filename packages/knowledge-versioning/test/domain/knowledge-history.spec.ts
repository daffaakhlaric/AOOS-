import { describe, expect, it } from "vitest";

import { KnowledgeHistory } from "../../src/domain/knowledge-history.js";
import { KnowledgeVersionState } from "../../src/domain/knowledge-version-state.js";

describe("KnowledgeHistory", () => {
  it("starts empty", () => {
    const history = new KnowledgeHistory("version-1");
    expect(history.count()).toBe(0);
    expect(history.entries()).toEqual([]);
    expect(history.latest()).toBeUndefined();
  });

  it("uses versionId as its id", () => {
    const history = new KnowledgeHistory("version-1");
    expect(history.id).toBe("version-1");
  });

  it("records an entry with an incrementing sequence", () => {
    const history = new KnowledgeHistory("version-1");
    const first = history.record({ operation: "createVersion" });
    const second = history.record({ operation: "publishVersion" });
    expect(first.sequence).toBe(0);
    expect(second.sequence).toBe(1);
    expect(history.count()).toBe(2);
  });

  it("stamps versionId and occurredAt on every entry", () => {
    const history = new KnowledgeHistory("version-1");
    const entry = history.record({ operation: "createVersion" });
    expect(entry.versionId).toBe("version-1");
    expect(entry.occurredAt).toBeTypeOf("string");
  });

  it("records optional fromState/toState/reason", () => {
    const history = new KnowledgeHistory("version-1");
    const entry = history.record({
      operation: "publishVersion",
      fromState: KnowledgeVersionState.VALIDATED,
      toState: KnowledgeVersionState.PUBLISHED,
      reason: "release",
    });
    expect(entry.fromState).toBe(KnowledgeVersionState.VALIDATED);
    expect(entry.toState).toBe(KnowledgeVersionState.PUBLISHED);
    expect(entry.reason).toBe("release");
  });

  it("entries() returns a defensive copy", () => {
    const history = new KnowledgeHistory("version-1");
    history.record({ operation: "createVersion" });
    const snapshot = history.entries();
    history.record({ operation: "publishVersion" });
    expect(snapshot.length).toBe(1);
    expect(history.entries().length).toBe(2);
  });

  it("latest() returns the most recently recorded entry", () => {
    const history = new KnowledgeHistory("version-1");
    history.record({ operation: "createVersion" });
    const second = history.record({ operation: "publishVersion" });
    expect(history.latest()).toEqual(second);
  });
});
