import { describe, expect, it } from "vitest";

import { ExpressionType } from "../../src/contracts/expression-type.js";
import { NodeType } from "../../src/contracts/node-type.js";
import { VariableScope } from "../../src/contracts/variable-scope.js";
import { VariableValidator } from "../../src/validator/variable-validator.js";
import { VariableType } from "../../src/variables/variable-type.js";
import { workflowFixture } from "../helpers/workflow-fixture.js";

describe("Variable Validation Test — VariableValidator", () => {
  it("passes when a Condition node references a declared workflow variable", () => {
    const workflow = workflowFixture({
      variables: [
        {
          name: "isReady",
          type: VariableType.BOOLEAN,
          scope: VariableScope.WORKFLOW,
          required: false,
        },
      ],
      nodes: [
        { id: "start", name: "S", type: NodeType.START },
        {
          id: "cond",
          name: "C",
          type: NodeType.CONDITION,
          condition: { type: ExpressionType.VARIABLE_REFERENCE, variableName: "isReady" },
        },
        { id: "end", name: "E", type: NodeType.END },
      ],
      transitions: [],
    });
    expect(new VariableValidator().validate(workflow).valid).toBe(true);
  });

  it("fails when a Condition node references an undeclared variable", () => {
    const workflow = workflowFixture({
      nodes: [
        { id: "start", name: "S", type: NodeType.START },
        {
          id: "cond",
          name: "C",
          type: NodeType.CONDITION,
          condition: { type: ExpressionType.VARIABLE_REFERENCE, variableName: "ghost" },
        },
        { id: "end", name: "E", type: NodeType.END },
      ],
      transitions: [],
    });
    const result = new VariableValidator().validate(workflow);
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("ghost");
  });

  it("resolves a variable declared at Node level too", () => {
    const workflow = workflowFixture({
      nodes: [
        { id: "start", name: "S", type: NodeType.START },
        {
          id: "cond",
          name: "C",
          type: NodeType.CONDITION,
          condition: { type: ExpressionType.VARIABLE_REFERENCE, variableName: "localFlag" },
          variables: [
            {
              name: "localFlag",
              type: VariableType.BOOLEAN,
              scope: VariableScope.NODE,
              required: false,
            },
          ],
        },
        { id: "end", name: "E", type: NodeType.END },
      ],
      transitions: [],
    });
    expect(new VariableValidator().validate(workflow).valid).toBe(true);
  });

  it("finds an undeclared variable reference nested inside a Boolean expression", () => {
    const workflow = workflowFixture({
      nodes: [
        { id: "start", name: "S", type: NodeType.START },
        {
          id: "cond",
          name: "C",
          type: NodeType.CONDITION,
          condition: {
            type: ExpressionType.BOOLEAN,
            operator: "and",
            operands: [
              { type: ExpressionType.VARIABLE_REFERENCE, variableName: "ghost" },
              { type: ExpressionType.LITERAL, value: true },
            ],
          },
        },
        { id: "end", name: "E", type: NodeType.END },
      ],
      transitions: [],
    });
    expect(new VariableValidator().validate(workflow).valid).toBe(false);
  });

  it("passes a workflow with no expressions at all", () => {
    expect(new VariableValidator().validate(workflowFixture()).valid).toBe(true);
  });
});
