import { describe, expect, it } from "vitest";

import { VariableBuilder } from "../../src/builder/variable-builder.js";
import { VariableScope } from "../../src/contracts/variable-scope.js";
import { BuilderException } from "../../src/errors/builder-exception.js";
import { VariableType } from "../../src/variables/variable-type.js";

describe("Builder API Test — VariableBuilder", () => {
  it("builds a minimal VariableDeclaration", () => {
    const variable = VariableBuilder.create(
      "count",
      VariableType.NUMBER,
      VariableScope.WORKFLOW,
    ).build();
    expect(variable).toEqual({
      name: "count",
      type: VariableType.NUMBER,
      scope: VariableScope.WORKFLOW,
      required: false,
    });
  });

  it("builds with required(), withDefault(), and withDescription()", () => {
    const variable = VariableBuilder.create("flag", VariableType.BOOLEAN, VariableScope.NODE)
      .required()
      .withDefault(true)
      .withDescription("A flag")
      .build();
    expect(variable.required).toBe(true);
    expect(variable.defaultValue).toBe(true);
    expect(variable.description).toBe("A flag");
  });

  it("throws BuilderException for an invalid variable name", () => {
    expect(() =>
      VariableBuilder.create("1-bad-name", VariableType.STRING, VariableScope.GLOBAL).build(),
    ).toThrow(BuilderException);
  });
});
