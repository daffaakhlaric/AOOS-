import { describe, expect, it } from "vitest";

import { KnowledgeFinding } from "../../src/value-objects/knowledge-finding.js";

describe("KnowledgeFinding", () => {
  it("constructs a valid finding", () => {
    const finding = new KnowledgeFinding({
      id: "finding-1",
      itemId: "item-1",
      category: "structure",
      message: "missing summary",
      severity: "warning",
    });
    expect(finding.message).toBe("missing summary");
  });

  it("is frozen (immutable)", () => {
    expect(
      Object.isFrozen(
        new KnowledgeFinding({
          id: "a",
          itemId: "b",
          category: "c",
          message: "m",
          severity: "info",
        }),
      ),
    ).toBe(true);
  });

  it("throws for an empty message", () => {
    expect(
      () =>
        new KnowledgeFinding({
          id: "a",
          itemId: "b",
          category: "c",
          message: " ",
          severity: "info",
        }),
    ).toThrow(RangeError);
  });
});
