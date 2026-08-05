import { describe, expect, it } from "vitest";

import { TenantScope } from "../../src/contracts/tenant-scope.js";
import { workflowDefinitionSchema } from "../../src/schemas/workflow-definition.js";
import { workflowFixture } from "../helpers/workflow-fixture.js";

describe("Schema Diagram Test — workflowDefinitionSchema (Workflow Root)", () => {
  it("accepts a minimal valid Workflow Definition", () => {
    expect(workflowDefinitionSchema.safeParse(workflowFixture()).success).toBe(true);
  });

  it("defaults tenantScope to Global when omitted", () => {
    const { tenantScope: _tenantScope, ...rest } = workflowFixture();
    const result = workflowDefinitionSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tenantScope).toBe(TenantScope.GLOBAL);
    }
  });

  it("accepts every Workflow Root field (namespace/displayName/description/labels/tags/metadata/variables/input/output/errorHandling/compensation/retry/timeout/events/permissions)", () => {
    const workflow = workflowFixture({
      namespace: "automotive",
      displayName: "Sample Workflow",
      description: "A sample workflow",
      labels: { team: "platform" },
      tags: ["sample", "demo"],
      tenantScope: TenantScope.TENANT,
      tenantId: "tenant-1",
      metadata: { custom: true },
      variables: [],
      input: { orderId: "string" },
      output: { result: "string" },
      errorHandling: { propagate: true },
      compensation: { compensationNodeId: "task-1" },
      retry: { strategy: "linear", maxAttempts: 3 },
      timeout: { durationMs: 60_000 },
      events: ["capability.resolved"],
      permissions: ["workflow.execute"],
    });
    expect(workflowDefinitionSchema.safeParse(workflow).success).toBe(true);
  });

  it("rejects an id with invalid characters", () => {
    expect(workflowDefinitionSchema.safeParse(workflowFixture({ id: "Not Valid!" })).success).toBe(
      false,
    );
  });

  it("rejects a non-SemVer version", () => {
    expect(workflowDefinitionSchema.safeParse(workflowFixture({ version: "v1" })).success).toBe(
      false,
    );
  });

  it("rejects an empty nodes array", () => {
    expect(workflowDefinitionSchema.safeParse(workflowFixture({ nodes: [] })).success).toBe(false);
  });
});
