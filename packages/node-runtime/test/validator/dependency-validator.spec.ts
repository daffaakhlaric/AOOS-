import { describe, expect, it } from "vitest";

import { DependencyValidator } from "../../src/validator/dependency-validator.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Node Validation Test — DependencyValidator", () => {
  it("passes when dependsOn is absent", () => {
    expect(new DependencyValidator().validate(executionFixture()).valid).toBe(true);
  });

  it("passes when dependsOn does not include the Node's own id", () => {
    const execution = executionFixture();
    const withDeps = {
      ...execution,
      instance: { ...execution.instance, dependsOn: ["other-node"] },
    };
    expect(new DependencyValidator().validate(withDeps).valid).toBe(true);
  });

  it("fails when a Node depends on itself", () => {
    const execution = executionFixture();
    const selfDep = {
      ...execution,
      instance: { ...execution.instance, dependsOn: [execution.instance.nodeId] },
    };
    const result = new DependencyValidator().validate(selfDep);
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("dependsOn");
  });
});
