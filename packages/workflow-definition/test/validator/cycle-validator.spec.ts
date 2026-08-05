import { describe, expect, it } from "vitest";

import { ExpressionType } from "../../src/contracts/expression-type.js";
import { NodeType } from "../../src/contracts/node-type.js";
import { TransitionKind } from "../../src/contracts/transition-kind.js";
import { CycleValidator } from "../../src/validator/cycle-validator.js";
import { workflowFixture } from "../helpers/workflow-fixture.js";

describe("Cycle Detection Test — CycleValidator", () => {
  it("passes an acyclic workflow", () => {
    expect(new CycleValidator().validate(workflowFixture()).valid).toBe(true);
  });

  it("Loop Detection: an intentional Loop node cycle is allowed", () => {
    const workflow = workflowFixture({
      nodes: [
        { id: "start", name: "S", type: NodeType.START },
        {
          id: "loop",
          name: "L",
          type: NodeType.LOOP,
          loopCondition: { type: ExpressionType.LITERAL, value: true },
          bodyNodeId: "body",
        },
        { id: "body", name: "Body", type: NodeType.TASK },
        { id: "end", name: "E", type: NodeType.END },
      ],
      transitions: [
        { id: "t-1", kind: TransitionKind.NEXT, fromNodeId: "start", toNodeId: "loop" },
        { id: "t-2", kind: TransitionKind.NEXT, fromNodeId: "loop", toNodeId: "end" },
      ],
    });
    expect(new CycleValidator().validate(workflow).valid).toBe(true);
  });

  it("Cycle Detection: an unintended cycle between two Task nodes is rejected", () => {
    const workflow = workflowFixture({
      nodes: [
        { id: "start", name: "S", type: NodeType.START },
        { id: "a", name: "A", type: NodeType.TASK },
        { id: "b", name: "B", type: NodeType.TASK },
        { id: "end", name: "E", type: NodeType.END },
      ],
      transitions: [
        { id: "t-1", kind: TransitionKind.NEXT, fromNodeId: "start", toNodeId: "a" },
        { id: "t-2", kind: TransitionKind.NEXT, fromNodeId: "a", toNodeId: "b" },
        { id: "t-3", kind: TransitionKind.NEXT, fromNodeId: "b", toNodeId: "a" },
        { id: "t-4", kind: TransitionKind.NEXT, fromNodeId: "a", toNodeId: "end" },
      ],
    });
    const result = new CycleValidator().validate(workflow);
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("Unintended cycle");
  });

  it("Cycle Detection: a self-referencing transition is rejected", () => {
    const workflow = workflowFixture({
      transitions: [
        { id: "t-1", kind: TransitionKind.NEXT, fromNodeId: "task-1", toNodeId: "task-1" },
      ],
    });
    expect(new CycleValidator().validate(workflow).valid).toBe(false);
  });
});
