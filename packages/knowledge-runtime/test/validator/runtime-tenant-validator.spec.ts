import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";
import { RuntimeTenantValidator } from "../../src/validator/runtime-tenant-validator.js";

const factory = new KnowledgeRuntimeFactory();

describe("Validator Test — RuntimeTenantValidator", () => {
  it("passes when no allow-list is configured", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    expect(new RuntimeTenantValidator().validate({ execution }).valid).toBe(true);
  });

  it("passes when tenantId is in the allow-list", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    expect(
      new RuntimeTenantValidator().validate({ execution, allowedTenantIds: ["tenant-1"] }).valid,
    ).toBe(true);
  });

  it("fails when tenantId is not in the allow-list", () => {
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    expect(
      new RuntimeTenantValidator().validate({ execution, allowedTenantIds: ["tenant-2"] }).valid,
    ).toBe(false);
  });
});
