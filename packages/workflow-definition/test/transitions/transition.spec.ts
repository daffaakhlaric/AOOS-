import { describe, expect, it } from "vitest";

import { ExpressionType } from "../../src/contracts/expression-type.js";
import { TransitionKind } from "../../src/contracts/transition-kind.js";
import { transitionSchema } from "../../src/transitions/transition.js";

describe("Transition Diagram Test — transitionSchema", () => {
  it("accepts a minimal Next transition", () => {
    expect(
      transitionSchema.safeParse({
        id: "t-1",
        kind: TransitionKind.NEXT,
        fromNodeId: "a",
        toNodeId: "b",
      }).success,
    ).toBe(true);
  });

  it("accepts every TransitionKind (Next/Condition/Parallel/Merge/Loop/Retry/Failure/Timeout/Compensation)", () => {
    for (const kind of Object.values(TransitionKind)) {
      expect(
        transitionSchema.safeParse({ id: "t-1", kind, fromNodeId: "a", toNodeId: "b" }).success,
      ).toBe(true);
    }
  });

  it("accepts a Condition transition with a condition expression, priority, and description", () => {
    expect(
      transitionSchema.safeParse({
        id: "t-1",
        kind: TransitionKind.CONDITION,
        fromNodeId: "a",
        toNodeId: "b",
        condition: { type: ExpressionType.LITERAL, value: true },
        priority: 1,
        description: "guarded edge",
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown TransitionKind", () => {
    expect(
      transitionSchema.safeParse({ id: "t-1", kind: "bogus", fromNodeId: "a", toNodeId: "b" })
        .success,
    ).toBe(false);
  });
});
