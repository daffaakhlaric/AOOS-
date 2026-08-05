import { describe, expect, it } from "vitest";

import { TenantValidator } from "../../src/validator/tenant-validator.js";
import { createJobInputFixture } from "../helpers/create-job-input-fixture.js";

describe("Validation Test — TenantValidator", () => {
  it("passes a platform-scoped input regardless of allowedTenantIds", () => {
    expect(
      new TenantValidator().validate(createJobInputFixture(), {
        allowedTenantIds: new Set(["t-1"]),
      }).valid,
    ).toBe(true);
  });

  it("passes a tenant-scoped input when no allowedTenantIds is configured", () => {
    const input = createJobInputFixture({ tenantId: "t-1" });
    expect(new TenantValidator().validate(input, {}).valid).toBe(true);
  });

  it("passes an allowed tenant", () => {
    const input = createJobInputFixture({ tenantId: "t-1" });
    expect(
      new TenantValidator().validate(input, { allowedTenantIds: new Set(["t-1"]) }).valid,
    ).toBe(true);
  });

  it("fails a disallowed tenant", () => {
    const input = createJobInputFixture({ tenantId: "t-2" });
    const result = new TenantValidator().validate(input, { allowedTenantIds: new Set(["t-1"]) });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("t-2");
  });
});
