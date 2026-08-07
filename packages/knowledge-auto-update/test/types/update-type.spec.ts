import { describe, expect, it } from "vitest";

import { ALL_UPDATE_TYPES, KnowledgeUpdateType } from "../../src/types/update-type.js";

describe("KnowledgeUpdateType", () => {
  it("defines exactly the 13 spec update types", () => {
    expect(Object.values(KnowledgeUpdateType)).toHaveLength(13);
  });

  it("has no duplicate values", () => {
    const values = Object.values(KnowledgeUpdateType);
    expect(new Set(values).size).toBe(values.length);
  });

  it("ALL_UPDATE_TYPES matches Object.values", () => {
    expect(ALL_UPDATE_TYPES).toEqual(Object.values(KnowledgeUpdateType));
  });

  it("includes every named type from the spec", () => {
    const expected = [
      "manual",
      "scheduled",
      "incremental",
      "full",
      "refresh",
      "synchronization",
      "version",
      "metadata",
      "policy",
      "dependency",
      "recovery",
      "retry",
      "emergency",
    ];
    expect([...ALL_UPDATE_TYPES].sort()).toEqual(expected.sort());
  });
});
