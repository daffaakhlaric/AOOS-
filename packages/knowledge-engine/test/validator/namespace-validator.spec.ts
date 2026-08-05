import { describe, expect, it } from "vitest";

import { NamespaceValidator } from "../../src/validator/namespace-validator.js";
import { assetFixture, scopeFixture } from "../helpers/asset-fixture.js";

describe("Validator Test — NamespaceValidator", () => {
  it("passes for a well-formed namespace matching scope.tenantId", () => {
    expect(new NamespaceValidator().validate({ asset: assetFixture() }).valid).toBe(true);
  });

  it("flags a malformed namespace", () => {
    const asset = { ...assetFixture(), namespace: "not-a-namespace" };
    const result = new NamespaceValidator().validate({ asset });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("namespace");
  });

  it("flags a namespace tenant that does not match scope.tenantId", () => {
    const asset = assetFixture({ scope: scopeFixture({ tenantId: "tenant-mismatch" }) });
    const mutated = { ...asset, namespace: "knowledge://different-tenant/w1/l1/d1" };
    const result = new NamespaceValidator().validate({ asset: mutated });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("does not match");
  });
});
