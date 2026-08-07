import { describe, expect, it } from "vitest";

import { knowledgePolicyActionSchema } from "../../src/domain/knowledge-policy-action.js";
import { knowledgePolicyAssignmentSchema } from "../../src/domain/knowledge-policy-assignment.js";
import { knowledgePolicyAuditEntrySchema } from "../../src/domain/knowledge-policy-audit.js";
import { knowledgePolicyConditionSchema } from "../../src/domain/knowledge-policy-condition.js";
import { knowledgePolicyConfigurationRecordSchema } from "../../src/domain/knowledge-policy-configuration-record.js";
import { knowledgePolicyInstanceSchema } from "../../src/domain/knowledge-policy-instance.js";
import { knowledgePolicyLogEntrySchema } from "../../src/domain/knowledge-policy-log.js";
import { knowledgePolicyMetadataSchema } from "../../src/domain/knowledge-policy-metadata.js";
import { knowledgePolicyPermissionGrantSchema } from "../../src/domain/knowledge-policy-permission-grant.js";
import { knowledgePolicyRuleSchema } from "../../src/domain/knowledge-policy-rule.js";
import { knowledgePolicyTraceSchema } from "../../src/domain/knowledge-policy-trace.js";
import { KnowledgePolicyType } from "../../src/domain/knowledge-policy-type.js";
import { ruleFixture } from "../helpers/rule-fixture.js";

function omit(record: Record<string, unknown>, field: string): Record<string, unknown> {
  const clone = { ...record };
  delete clone[field];
  return clone;
}

const validMetadata = {
  policyId: "policy-1",
  policyName: "Test",
  policyType: KnowledgePolicyType.ACCESS,
  priority: 0,
  tenantId: "tenant-1",
  labels: [],
  tags: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("knowledgePolicyMetadataSchema — required field rejections", () => {
  it.each(["policyId", "policyName", "tenantId"])("rejects a missing %s", (field) => {
    expect(knowledgePolicyMetadataSchema.safeParse(omit(validMetadata, field)).success).toBe(false);
  });

  it("rejects a non-datetime createdAt", () => {
    const result = knowledgePolicyMetadataSchema.safeParse({
      ...validMetadata,
      createdAt: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown policyType", () => {
    const result = knowledgePolicyMetadataSchema.safeParse({
      ...validMetadata,
      policyType: "bogus",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields when supplied", () => {
    const result = knowledgePolicyMetadataSchema.safeParse({
      ...validMetadata,
      policyDescription: "desc",
      workspaceId: "workspace-1",
      createdBy: "user-1",
      updatedBy: "user-1",
    });
    expect(result.success).toBe(true);
  });
});

describe("knowledgePolicyInstanceSchema — required field rejections", () => {
  const base = {
    id: "instance-1",
    token: "kpol_x",
    policyId: "policy-1",
    tenantId: "tenant-1",
    state: "draft",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("accepts optional activatedAt/destroyedAt", () => {
    const result = knowledgePolicyInstanceSchema.safeParse({
      ...base,
      activatedAt: "2026-01-01T00:00:00.000Z",
      destroyedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it.each(["id", "token", "policyId", "tenantId"])("rejects a missing %s", (field) => {
    expect(knowledgePolicyInstanceSchema.safeParse(omit(base, field)).success).toBe(false);
  });
});

describe("knowledgePolicyRuleSchema — required field rejections", () => {
  it("rejects a blank name", () => {
    const result = knowledgePolicyRuleSchema.safeParse({ ...ruleFixture(), name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative priority", () => {
    const result = knowledgePolicyRuleSchema.safeParse({ ...ruleFixture(), priority: -1 });
    expect(result.success).toBe(false);
  });

  it("accepts an optional description", () => {
    const result = knowledgePolicyRuleSchema.safeParse({ ...ruleFixture(), description: "desc" });
    expect(result.success).toBe(true);
  });
});

describe("knowledgePolicyAssignmentSchema — required field rejections", () => {
  const valid = {
    id: "assignment-1",
    policyId: "policy-1",
    targetType: "workspace",
    targetId: "workspace-1",
    priority: 0,
    assignedAt: "2026-01-01T00:00:00.000Z",
    metadata: {},
  };

  it.each(["targetType", "targetId"])("rejects a missing %s", (field) => {
    expect(knowledgePolicyAssignmentSchema.safeParse(omit(valid, field)).success).toBe(false);
  });

  it("accepts an optional assignedBy", () => {
    expect(
      knowledgePolicyAssignmentSchema.safeParse({ ...valid, assignedBy: "user-1" }).success,
    ).toBe(true);
  });
});

describe("knowledgePolicyConditionSchema — required field rejections", () => {
  it("rejects a blank operator", () => {
    const result = knowledgePolicyConditionSchema.safeParse({
      id: "c1",
      ruleId: "r1",
      field: "type",
      operator: "",
      value: 1,
      metadata: {},
    });
    expect(result.success).toBe(false);
  });

  it("accepts any unknown value", () => {
    const result = knowledgePolicyConditionSchema.safeParse({
      id: "c1",
      ruleId: "r1",
      field: "type",
      operator: "eq",
      value: { nested: true },
      metadata: {},
    });
    expect(result.success).toBe(true);
  });
});

describe("knowledgePolicyActionSchema — required field rejections", () => {
  it("rejects a blank ruleId", () => {
    const result = knowledgePolicyActionSchema.safeParse({
      id: "a1",
      ruleId: "",
      actionType: "notify",
      parameters: {},
      metadata: {},
    });
    expect(result.success).toBe(false);
  });
});

describe("knowledgePolicyAuditEntrySchema — optional fields", () => {
  it("accepts optional fromState/toState/reason", () => {
    const result = knowledgePolicyAuditEntrySchema.safeParse({
      id: "audit-1",
      operation: "activate_policy",
      policyId: "policy-1",
      tenantId: "tenant-1",
      fromState: "validated",
      toState: "active",
      reason: "go-live",
      occurredAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a blank operation", () => {
    const result = knowledgePolicyAuditEntrySchema.safeParse({
      id: "audit-1",
      operation: "",
      policyId: "policy-1",
      tenantId: "tenant-1",
      occurredAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("knowledgePolicyConfigurationRecordSchema — optional numeric bounds", () => {
  it("rejects a maxRules below 1", () => {
    const result = knowledgePolicyConfigurationRecordSchema.safeParse({
      policyId: "policy-1",
      enforceMode: "strict",
      allowOverride: false,
      maxRules: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts evaluationTimeout of 0", () => {
    const result = knowledgePolicyConfigurationRecordSchema.safeParse({
      policyId: "policy-1",
      enforceMode: "audit",
      allowOverride: false,
      evaluationTimeout: 0,
    });
    expect(result.success).toBe(true);
  });
});

describe("knowledgePolicyLogEntrySchema — required field rejections", () => {
  it("rejects a blank message", () => {
    const result = knowledgePolicyLogEntrySchema.safeParse({
      sequence: 0,
      level: "info",
      operation: "create_policy",
      message: "",
      occurredAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative sequence", () => {
    const result = knowledgePolicyLogEntrySchema.safeParse({
      sequence: -1,
      level: "info",
      operation: "create_policy",
      message: "done",
      occurredAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("knowledgePolicyTraceSchema — required field rejections", () => {
  it("rejects a runCount below 1", () => {
    const result = knowledgePolicyTraceSchema.safeParse({
      traceId: "trace-1",
      correlationId: "corr-1",
      operation: "create_policy",
      tracedAt: "2026-01-01T00:00:00.000Z",
      runCount: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("knowledgePolicyPermissionGrantSchema — optional fields", () => {
  it("accepts an optional operation and policyType", () => {
    const result = knowledgePolicyPermissionGrantSchema.safeParse({
      id: "grant-1",
      scope: { tenantId: "tenant-1", workspaceId: "workspace-1" },
      effect: "deny",
      operation: "destroy_policy",
      policyType: "access",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing scope.tenantId", () => {
    const result = knowledgePolicyPermissionGrantSchema.safeParse({
      id: "grant-1",
      scope: {},
      effect: "allow",
    });
    expect(result.success).toBe(false);
  });
});
