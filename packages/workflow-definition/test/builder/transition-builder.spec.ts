import { describe, expect, it } from "vitest";

import { TransitionBuilder } from "../../src/builder/transition-builder.js";
import { ExpressionType } from "../../src/contracts/expression-type.js";
import { TransitionKind } from "../../src/contracts/transition-kind.js";
import { BuilderException } from "../../src/errors/builder-exception.js";

describe("Builder API Test — TransitionBuilder", () => {
  it("builds a minimal Transition", () => {
    const transition = TransitionBuilder.create("t-1", TransitionKind.NEXT, "a", "b").build();
    expect(transition).toMatchObject({
      id: "t-1",
      kind: TransitionKind.NEXT,
      fromNodeId: "a",
      toNodeId: "b",
    });
  });

  it("builds with withCondition(), withPriority(), and withDescription()", () => {
    const transition = TransitionBuilder.create("t-1", TransitionKind.CONDITION, "a", "b")
      .withCondition({ type: ExpressionType.LITERAL, value: true })
      .withPriority(1)
      .withDescription("Go to b")
      .build();
    expect(transition.condition).toEqual({ type: ExpressionType.LITERAL, value: true });
    expect(transition.priority).toBe(1);
    expect(transition.description).toBe("Go to b");
  });

  it("throws BuilderException for an empty id", () => {
    expect(() => TransitionBuilder.create("", TransitionKind.NEXT, "a", "b").build()).toThrow(
      BuilderException,
    );
  });
});
