import { describe, expect, it } from "vitest";

import { TenantValidator } from "../../src/validator/tenant-validator.js";
import { assetFixture, scopeFixture } from "../helpers/asset-fixture.js";

describe("Validator Test — TenantValidator", () => {
  it("passes when allowedTenantIds is not configured", () => {
    expect(new TenantValidator().validate({ asset: assetFixture() }).valid).toBe(true);
  });

  it("passes when the tenantId is in the allow-list", () => {
    const asset = assetFixture({ scope: scopeFixture({ tenantId: "tenant-1" }) });
    expect(new TenantValidator().validate({ asset, allowedTenantIds: ["tenant-1"] }).valid).toBe(
      true,
    );
  });

  it("flags a tenantId not in the allow-list", () => {
    const asset = assetFixture({ scope: scopeFixture({ tenantId: "tenant-9" }) });
    expect(new TenantValidator().validate({ asset, allowedTenantIds: ["tenant-1"] }).valid).toBe(
      false,
    );
  });
});
