import { describe, expect, it } from "vitest";

import { KnowledgeConflictResolutionStrategy } from "../../src/domain/knowledge-conflict-resolution-strategy.js";

describe("KnowledgeConflictResolutionStrategy", () => {
  it("has exactly 5 strategies", () => {
    expect(Object.values(KnowledgeConflictResolutionStrategy)).toHaveLength(5);
  });

  it("includes LAST_WRITE_WINS, MERGE, CUSTOM", () => {
    expect(KnowledgeConflictResolutionStrategy.LAST_WRITE_WINS).toBe("last_write_wins");
    expect(KnowledgeConflictResolutionStrategy.MERGE).toBe("merge");
    expect(KnowledgeConflictResolutionStrategy.CUSTOM).toBe("custom");
  });
});
