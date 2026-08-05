import { describe, expect, it } from "vitest";

import { PermissionValidator } from "../../src/validator/permission-validator.js";

describe("Validator Test — PermissionValidator", () => {
  it("passes when no permission is supplied", () => {
    expect(new PermissionValidator().validate({}).valid).toBe(true);
  });

  it("passes for a non-blank action", () => {
    const result = new PermissionValidator().validate({
      permission: {
        id: "perm-1",
        subjectType: "user",
        subjectId: "u1",
        action: "read",
        effect: "allow",
        scope: { tenantId: "t1" },
        createdAt: new Date().toISOString(),
      },
    });
    expect(result.valid).toBe(true);
  });

  it("flags a blank action", () => {
    const result = new PermissionValidator().validate({
      permission: {
        id: "perm-1",
        subjectType: "user",
        subjectId: "u1",
        action: "   ",
        effect: "allow",
        scope: { tenantId: "t1" },
        createdAt: new Date().toISOString(),
      },
    });
    expect(result.valid).toBe(false);
  });
});
