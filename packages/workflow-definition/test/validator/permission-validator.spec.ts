import { describe, expect, it } from "vitest";

import { PermissionValidator } from "../../src/validator/permission-validator.js";
import { workflowFixture } from "../helpers/workflow-fixture.js";

describe("PermissionValidator", () => {
  it("passes a workflow with no permissions field", () => {
    expect(new PermissionValidator().validate(workflowFixture()).valid).toBe(true);
  });

  it("accepts well-formed resource.action permission strings", () => {
    const result = new PermissionValidator().validate(
      workflowFixture({ permissions: ["workflow.execute", "inventory.read"] }),
    );
    expect(result.valid).toBe(true);
  });

  it("rejects a malformed permission string", () => {
    const result = new PermissionValidator().validate(
      workflowFixture({ permissions: ["not-a-permission"] }),
    );
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("resource.action");
  });
});
