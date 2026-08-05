import { describe, expect, it } from "vitest";

import { VariableScope } from "../../src/contracts/variable-scope.js";
import { variableDeclarationSchema } from "../../src/variables/variable-declaration.js";
import { VariableType } from "../../src/variables/variable-type.js";

describe("Variable Test — variableDeclarationSchema", () => {
  it("accepts a minimal declaration", () => {
    const result = variableDeclarationSchema.safeParse({
      name: "orderId",
      type: VariableType.STRING,
      scope: VariableScope.WORKFLOW,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.required).toBe(false);
    }
  });

  it("accepts every scope (Workflow/Node/Global/Temporary/Environment)", () => {
    for (const scope of Object.values(VariableScope)) {
      expect(
        variableDeclarationSchema.safeParse({ name: "x", type: VariableType.ANY, scope }).success,
      ).toBe(true);
    }
  });

  it("accepts a full declaration", () => {
    expect(
      variableDeclarationSchema.safeParse({
        name: "retryCount",
        type: VariableType.NUMBER,
        scope: VariableScope.TEMPORARY,
        required: true,
        defaultValue: 0,
        description: "Number of retries so far",
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid identifier name", () => {
    expect(
      variableDeclarationSchema.safeParse({
        name: "123-bad",
        type: VariableType.STRING,
        scope: VariableScope.WORKFLOW,
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown type", () => {
    expect(
      variableDeclarationSchema.safeParse({
        name: "x",
        type: "bogus",
        scope: VariableScope.WORKFLOW,
      }).success,
    ).toBe(false);
  });
});
