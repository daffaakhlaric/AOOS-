import { describe, expect, it } from "vitest";

import { PermissionValidator } from "../../src/validators/permission-validator.js";

describe("PermissionValidator", () => {
  it("accepts well-formed resource.action permission strings", () => {
    const validator = new PermissionValidator();
    const result = validator.validate({
      id: "a",
      version: "1.0.0",
      category: "x",
      permissions: ["social.publish"],
    });
    expect(result.valid).toBe(true);
  });

  it("accepts a manifest with no permissions field", () => {
    const validator = new PermissionValidator();
    expect(validator.validate({ id: "a", version: "1.0.0", category: "x" }).valid).toBe(true);
  });

  it("rejects a malformed permission string", () => {
    const validator = new PermissionValidator();
    const result = validator.validate({
      id: "a",
      version: "1.0.0",
      category: "x",
      permissions: ["not-a-permission"],
    });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("resource.action");
  });
});
