import { describe, expect, it } from "vitest";

import { ExpressionType } from "../../src/contracts/expression-type.js";
import { TransitionKind } from "../../src/contracts/transition-kind.js";
import { TransitionValidator } from "../../src/validator/transition-validator.js";
import { workflowFixture } from "../helpers/workflow-fixture.js";

describe("Transition Validation Test — TransitionValidator", () => {
  it("passes well-formed transitions", () => {
    expect(new TransitionValidator().validate(workflowFixture()).valid).toBe(true);
  });

  it("fails when fromNodeId is unknown", () => {
    const workflow = workflowFixture({
      transitions: [
        { id: "t-1", kind: TransitionKind.NEXT, fromNodeId: "ghost", toNodeId: "task-1" },
      ],
    });
    const result = new TransitionValidator().validate(workflow);
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toContain("fromNodeId");
  });

  it("fails when toNodeId is unknown", () => {
    const workflow = workflowFixture({
      transitions: [
        { id: "t-1", kind: TransitionKind.NEXT, fromNodeId: "start", toNodeId: "ghost" },
      ],
    });
    expect(new TransitionValidator().validate(workflow).valid).toBe(false);
  });

  it("fails when a Condition transition has no condition expression", () => {
    const workflow = workflowFixture({
      transitions: [
        { id: "t-1", kind: TransitionKind.CONDITION, fromNodeId: "start", toNodeId: "task-1" },
      ],
    });
    const result = new TransitionValidator().validate(workflow);
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("condition");
  });

  it("passes a Condition transition with a condition expression", () => {
    const workflow = workflowFixture({
      transitions: [
        {
          id: "t-1",
          kind: TransitionKind.CONDITION,
          fromNodeId: "start",
          toNodeId: "task-1",
          condition: { type: ExpressionType.LITERAL, value: true },
        },
      ],
    });
    expect(new TransitionValidator().validate(workflow).valid).toBe(true);
  });

  it("passes when there are no transitions at all", () => {
    const workflow = workflowFixture({ transitions: [] });
    expect(new TransitionValidator().validate(workflow).valid).toBe(true);
  });
});
