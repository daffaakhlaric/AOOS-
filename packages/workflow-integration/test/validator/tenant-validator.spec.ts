import { describe, expect, it } from "vitest";

import { WorkflowIntegrationRegistry } from "../../src/registry/workflow-integration-registry.js";
import { TenantValidator } from "../../src/validator/tenant-validator.js";
import { contextFixture } from "../helpers/context-fixture.js";

describe("Validator Test — TenantValidator", () => {
  it("passes when allowedTenantIds is not configured", () => {
    const result = new TenantValidator().validate({
      registry: new WorkflowIntegrationRegistry(),
      context: contextFixture({ tenantId: "tenant-1" }),
    });
    expect(result.valid).toBe(true);
  });

  it("passes when the Context's tenantId is in the allow-list", () => {
    const result = new TenantValidator().validate({
      registry: new WorkflowIntegrationRegistry(),
      context: contextFixture({ tenantId: "tenant-1" }),
      allowedTenantIds: ["tenant-1", "tenant-2"],
    });
    expect(result.valid).toBe(true);
  });

  it("flags a Context whose tenantId is not in the allow-list", () => {
    const result = new TenantValidator().validate({
      registry: new WorkflowIntegrationRegistry(),
      context: contextFixture({ tenantId: "tenant-9" }),
      allowedTenantIds: ["tenant-1"],
    });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain("tenant-9");
  });

  it("passes when no Context is supplied", () => {
    const result = new TenantValidator().validate({
      registry: new WorkflowIntegrationRegistry(),
      allowedTenantIds: ["tenant-1"],
    });
    expect(result.valid).toBe(true);
  });
});
