import { describe, expect, it } from "vitest";

import { NodeType } from "../../src/contracts/node-type.js";
import { TransitionKind } from "../../src/contracts/transition-kind.js";
import { VariableScope } from "../../src/contracts/variable-scope.js";
import { DuplicateValidator } from "../../src/validator/duplicate-validator.js";
import { VariableType } from "../../src/variables/variable-type.js";
import { workflowFixture } from "../helpers/workflow-fixture.js";

describe("Duplicate Detection Test — DuplicateValidator", () => {
  it("passes a well-formed workflow", () => {
    expect(new DuplicateValidator().validate(workflowFixture()).valid).toBe(true);
  });

  it("flags a duplicate node id", () => {
    const workflow = workflowFixture({
      nodes: [
        { id: "start", name: "S", type: NodeType.START },
        { id: "start", name: "S2", type: NodeType.TASK },
        { id: "end", name: "E", type: NodeType.END },
      ],
    });
    const result = new DuplicateValidator().validate(workflow);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes('"start"'))).toBe(true);
  });

  it("flags a duplicate transition id", () => {
    const workflow = workflowFixture({
      transitions: [
        { id: "t-1", kind: TransitionKind.NEXT, fromNodeId: "start", toNodeId: "task-1" },
        { id: "t-1", kind: TransitionKind.NEXT, fromNodeId: "task-1", toNodeId: "end" },
      ],
    });
    expect(new DuplicateValidator().validate(workflow).valid).toBe(false);
  });

  it("flags a duplicate workflow-level variable name within the same scope", () => {
    const workflow = workflowFixture({
      variables: [
        { name: "x", type: VariableType.STRING, scope: VariableScope.WORKFLOW, required: false },
        { name: "x", type: VariableType.NUMBER, scope: VariableScope.WORKFLOW, required: false },
      ],
    });
    expect(new DuplicateValidator().validate(workflow).valid).toBe(false);
  });

  it("allows the same variable name in two different scopes", () => {
    const workflow = workflowFixture({
      variables: [
        { name: "x", type: VariableType.STRING, scope: VariableScope.WORKFLOW, required: false },
        { name: "x", type: VariableType.STRING, scope: VariableScope.GLOBAL, required: false },
      ],
    });
    expect(new DuplicateValidator().validate(workflow).valid).toBe(true);
  });

  it("flags a duplicate node-level variable name within the same scope", () => {
    const workflow = workflowFixture({
      nodes: [
        { id: "start", name: "S", type: NodeType.START },
        {
          id: "task-1",
          name: "T",
          type: NodeType.TASK,
          variables: [
            { name: "y", type: VariableType.STRING, scope: VariableScope.NODE, required: false },
            { name: "y", type: VariableType.STRING, scope: VariableScope.NODE, required: false },
          ],
        },
        { id: "end", name: "E", type: NodeType.END },
      ],
    });
    expect(new DuplicateValidator().validate(workflow).valid).toBe(false);
  });
});
