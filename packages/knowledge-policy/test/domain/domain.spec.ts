import { describe, expect, it } from "vitest";

import { knowledgePolicyActionSchema } from "../../src/domain/knowledge-policy-action.js";
import { knowledgePolicyAssignmentSchema } from "../../src/domain/knowledge-policy-assignment.js";
import { knowledgePolicyAuditEntrySchema } from "../../src/domain/knowledge-policy-audit.js";
import { knowledgePolicyConditionSchema } from "../../src/domain/knowledge-policy-condition.js";
import { knowledgePolicyConfigurationRecordSchema } from "../../src/domain/knowledge-policy-configuration-record.js";
import {
  KnowledgePolicyEvaluationResult,
  knowledgePolicyEvaluationSchema,
} from "../../src/domain/knowledge-policy-evaluation.js";
import { KnowledgePolicyHistory } from "../../src/domain/knowledge-policy-history.js";
import { knowledgePolicyInstanceSchema } from "../../src/domain/knowledge-policy-instance.js";
import { knowledgePolicyLogEntrySchema } from "../../src/domain/knowledge-policy-log.js";
import { knowledgePolicyMetadataSchema } from "../../src/domain/knowledge-policy-metadata.js";
import { KnowledgePolicyOperation } from "../../src/domain/knowledge-policy-operation.js";
import { knowledgePolicyPermissionGrantSchema } from "../../src/domain/knowledge-policy-permission-grant.js";
import { KnowledgePolicyRecord } from "../../src/domain/knowledge-policy-record.js";
import { KnowledgePolicyRuleType } from "../../src/domain/knowledge-policy-rule-type.js";
import { knowledgePolicyRuleSchema } from "../../src/domain/knowledge-policy-rule.js";
import { KnowledgePolicyScopeType } from "../../src/domain/knowledge-policy-scope-type.js";
import { knowledgePolicyScopeSchema } from "../../src/domain/knowledge-policy-scope.js";
import { knowledgePolicyStateSchema } from "../../src/domain/knowledge-policy-state-schema.js";
import {
  KNOWLEDGE_POLICY_SETTLED_STATES,
  KNOWLEDGE_POLICY_STATE_TRANSITIONS,
  KNOWLEDGE_POLICY_TERMINAL_STATES,
  KnowledgePolicyState,
} from "../../src/domain/knowledge-policy-state.js";
import {
  EMPTY_KNOWLEDGE_POLICY_STATISTICS,
  knowledgePolicyStatisticsSnapshotSchema,
} from "../../src/domain/knowledge-policy-statistics-snapshot.js";
import { knowledgePolicyTraceSchema } from "../../src/domain/knowledge-policy-trace.js";
import { KnowledgePolicyType } from "../../src/domain/knowledge-policy-type.js";
import { executionFixture } from "../helpers/execution-fixture.js";
import { ruleFixture } from "../helpers/rule-fixture.js";
import { scopeFixture } from "../helpers/scope-fixture.js";

describe("KnowledgePolicyType", () => {
  it("has exactly 10 members", () => {
    expect(Object.values(KnowledgePolicyType)).toHaveLength(10);
  });
});

describe("KnowledgePolicyScopeType", () => {
  it("has exactly 9 members", () => {
    expect(Object.values(KnowledgePolicyScopeType)).toHaveLength(9);
  });
});

describe("KnowledgePolicyRuleType", () => {
  it("has exactly 5 members", () => {
    expect(Object.values(KnowledgePolicyRuleType)).toHaveLength(5);
  });
});

describe("KnowledgePolicyOperation", () => {
  it("has exactly 10 members", () => {
    expect(Object.values(KnowledgePolicyOperation)).toHaveLength(10);
  });
});

describe("KnowledgePolicyState", () => {
  it("has exactly 9 members", () => {
    expect(Object.values(KnowledgePolicyState)).toHaveLength(9);
  });

  it("marks DESTROYED as the only terminal state", () => {
    expect(KNOWLEDGE_POLICY_TERMINAL_STATES.size).toBe(1);
    expect(KNOWLEDGE_POLICY_TERMINAL_STATES.has(KnowledgePolicyState.DESTROYED)).toBe(true);
  });

  it("has no outgoing transitions from DESTROYED", () => {
    expect(KNOWLEDGE_POLICY_STATE_TRANSITIONS[KnowledgePolicyState.DESTROYED]).toEqual([]);
  });

  it("every non-terminal state can reach DESTROYED", () => {
    for (const state of Object.values(KnowledgePolicyState)) {
      if (state === KnowledgePolicyState.DESTROYED) {
        continue;
      }
      expect(KNOWLEDGE_POLICY_STATE_TRANSITIONS[state]).toContain(KnowledgePolicyState.DESTROYED);
    }
  });

  it("marks SUSPENDED/DEPRECATED/ARCHIVED/DESTROYED as settled", () => {
    expect(KNOWLEDGE_POLICY_SETTLED_STATES.has(KnowledgePolicyState.SUSPENDED)).toBe(true);
    expect(KNOWLEDGE_POLICY_SETTLED_STATES.has(KnowledgePolicyState.DEPRECATED)).toBe(true);
    expect(KNOWLEDGE_POLICY_SETTLED_STATES.has(KnowledgePolicyState.ARCHIVED)).toBe(true);
    expect(KNOWLEDGE_POLICY_SETTLED_STATES.has(KnowledgePolicyState.DESTROYED)).toBe(true);
    expect(KNOWLEDGE_POLICY_SETTLED_STATES.has(KnowledgePolicyState.ACTIVE)).toBe(false);
  });

  it("validates via knowledgePolicyStateSchema", () => {
    expect(knowledgePolicyStateSchema.safeParse(KnowledgePolicyState.DRAFT).success).toBe(true);
    expect(knowledgePolicyStateSchema.safeParse("not-a-state").success).toBe(false);
  });
});

describe("knowledgePolicyMetadataSchema", () => {
  it("accepts a well-formed metadata record", () => {
    const result = knowledgePolicyMetadataSchema.safeParse({
      policyId: "policy-1",
      policyName: "Test",
      policyType: KnowledgePolicyType.ACCESS,
      priority: 0,
      tenantId: "tenant-1",
      labels: [],
      tags: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative priority", () => {
    const result = knowledgePolicyMetadataSchema.safeParse({
      policyId: "policy-1",
      policyName: "Test",
      policyType: KnowledgePolicyType.ACCESS,
      priority: -1,
      tenantId: "tenant-1",
      labels: [],
      tags: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("knowledgePolicyInstanceSchema", () => {
  it("accepts a well-formed instance", () => {
    const result = knowledgePolicyInstanceSchema.safeParse({
      id: "instance-1",
      token: "kpol_x",
      policyId: "policy-1",
      tenantId: "tenant-1",
      state: KnowledgePolicyState.DRAFT,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid state", () => {
    const result = knowledgePolicyInstanceSchema.safeParse({
      id: "instance-1",
      token: "kpol_x",
      policyId: "policy-1",
      tenantId: "tenant-1",
      state: "bogus",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("knowledgePolicyRuleSchema", () => {
  it("accepts a valid rule", () => {
    expect(knowledgePolicyRuleSchema.safeParse(ruleFixture()).success).toBe(true);
  });

  it("rejects an invalid ruleType", () => {
    const result = knowledgePolicyRuleSchema.safeParse({ ...ruleFixture(), ruleType: "bogus" });
    expect(result.success).toBe(false);
  });
});

describe("knowledgePolicyScopeSchema", () => {
  it("accepts a valid scope", () => {
    expect(knowledgePolicyScopeSchema.safeParse(scopeFixture()).success).toBe(true);
  });

  it("rejects an invalid scopeType", () => {
    const result = knowledgePolicyScopeSchema.safeParse({ ...scopeFixture(), scopeType: "bogus" });
    expect(result.success).toBe(false);
  });
});

describe("knowledgePolicyConditionSchema", () => {
  it("accepts a valid condition", () => {
    const result = knowledgePolicyConditionSchema.safeParse({
      id: "cond-1",
      ruleId: "rule-1",
      field: "type",
      operator: "equals",
      value: "document",
      metadata: {},
    });
    expect(result.success).toBe(true);
  });

  it("rejects a blank field", () => {
    const result = knowledgePolicyConditionSchema.safeParse({
      id: "cond-1",
      ruleId: "rule-1",
      field: "",
      operator: "equals",
      value: "document",
      metadata: {},
    });
    expect(result.success).toBe(false);
  });
});

describe("knowledgePolicyActionSchema", () => {
  it("accepts a valid action", () => {
    const result = knowledgePolicyActionSchema.safeParse({
      id: "action-1",
      ruleId: "rule-1",
      actionType: "notify",
      parameters: {},
      metadata: {},
    });
    expect(result.success).toBe(true);
  });

  it("rejects a blank actionType", () => {
    const result = knowledgePolicyActionSchema.safeParse({
      id: "action-1",
      ruleId: "rule-1",
      actionType: "",
      parameters: {},
      metadata: {},
    });
    expect(result.success).toBe(false);
  });
});

describe("knowledgePolicyAssignmentSchema", () => {
  it("accepts a valid assignment", () => {
    const result = knowledgePolicyAssignmentSchema.safeParse({
      id: "assignment-1",
      policyId: "policy-1",
      targetType: "workspace",
      targetId: "workspace-1",
      priority: 0,
      assignedAt: "2026-01-01T00:00:00.000Z",
      metadata: {},
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative priority", () => {
    const result = knowledgePolicyAssignmentSchema.safeParse({
      id: "assignment-1",
      policyId: "policy-1",
      targetType: "workspace",
      targetId: "workspace-1",
      priority: -1,
      assignedAt: "2026-01-01T00:00:00.000Z",
      metadata: {},
    });
    expect(result.success).toBe(false);
  });
});

describe("knowledgePolicyEvaluationSchema", () => {
  it("accepts a valid evaluation", () => {
    const result = knowledgePolicyEvaluationSchema.safeParse({
      id: "eval-1",
      policyId: "policy-1",
      targetId: "target-1",
      result: KnowledgePolicyEvaluationResult.PASS,
      violations: [],
      evaluatedAt: "2026-01-01T00:00:00.000Z",
      metadata: {},
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid result enum", () => {
    const result = knowledgePolicyEvaluationSchema.safeParse({
      id: "eval-1",
      policyId: "policy-1",
      targetId: "target-1",
      result: "bogus",
      violations: [],
      evaluatedAt: "2026-01-01T00:00:00.000Z",
      metadata: {},
    });
    expect(result.success).toBe(false);
  });

  it("has 4 KnowledgePolicyEvaluationResult members", () => {
    expect(Object.values(KnowledgePolicyEvaluationResult)).toHaveLength(4);
  });
});

describe("knowledgePolicyAuditEntrySchema", () => {
  it("accepts a valid audit entry", () => {
    const result = knowledgePolicyAuditEntrySchema.safeParse({
      id: "audit-1",
      operation: "create_policy",
      policyId: "policy-1",
      tenantId: "tenant-1",
      occurredAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });
});

describe("knowledgePolicyConfigurationRecordSchema", () => {
  it("accepts a valid configuration", () => {
    const result = knowledgePolicyConfigurationRecordSchema.safeParse({
      policyId: "policy-1",
      enforceMode: "strict",
      allowOverride: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid enforceMode", () => {
    const result = knowledgePolicyConfigurationRecordSchema.safeParse({
      policyId: "policy-1",
      enforceMode: "bogus",
      allowOverride: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("knowledgePolicyLogEntrySchema", () => {
  it("accepts a valid log entry", () => {
    const result = knowledgePolicyLogEntrySchema.safeParse({
      sequence: 0,
      level: "info",
      operation: "create_policy",
      message: "done",
      occurredAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });
});

describe("knowledgePolicyTraceSchema", () => {
  it("accepts a valid trace", () => {
    const result = knowledgePolicyTraceSchema.safeParse({
      traceId: "trace-1",
      correlationId: "corr-1",
      operation: "create_policy",
      tracedAt: "2026-01-01T00:00:00.000Z",
      runCount: 1,
    });
    expect(result.success).toBe(true);
  });
});

describe("knowledgePolicyPermissionGrantSchema", () => {
  it("accepts a valid grant", () => {
    const result = knowledgePolicyPermissionGrantSchema.safeParse({
      id: "grant-1",
      scope: { tenantId: "tenant-1" },
      effect: "allow",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid effect", () => {
    const result = knowledgePolicyPermissionGrantSchema.safeParse({
      id: "grant-1",
      scope: { tenantId: "tenant-1" },
      effect: "bogus",
    });
    expect(result.success).toBe(false);
  });
});

describe("knowledgePolicyStatisticsSnapshotSchema", () => {
  it("accepts the empty statistics constant", () => {
    expect(
      knowledgePolicyStatisticsSnapshotSchema.safeParse(EMPTY_KNOWLEDGE_POLICY_STATISTICS).success,
    ).toBe(true);
  });

  it("empty statistics has zero counts", () => {
    expect(EMPTY_KNOWLEDGE_POLICY_STATISTICS.createdCount).toBe(0);
    expect(EMPTY_KNOWLEDGE_POLICY_STATISTICS.activatedCount).toBe(0);
  });
});

describe("KnowledgePolicyHistory", () => {
  it("records entries with an incrementing sequence", () => {
    const history = new KnowledgePolicyHistory("policy-1");
    const first = history.record({ operation: "create_policy" });
    const second = history.record({
      operation: "activate_policy",
      fromState: "created",
      toState: "active",
    });
    expect(first.sequence).toBe(0);
    expect(second.sequence).toBe(1);
    expect(history.count()).toBe(2);
    expect(history.list()).toHaveLength(2);
    expect(history.id).toBe("policy-1");
  });

  it("starts empty", () => {
    const history = new KnowledgePolicyHistory("policy-2");
    expect(history.count()).toBe(0);
    expect(history.list()).toEqual([]);
  });
});

describe("KnowledgePolicyRecord", () => {
  it("exposes execution fields via getters", () => {
    const execution = executionFixture();
    const record = new KnowledgePolicyRecord(execution);
    expect(record.id).toBe(execution.instance.id);
    expect(record.token).toBe(execution.instance.token);
    expect(record.policyId).toBe(execution.metadata.policyId);
    expect(record.policyName).toBe(execution.metadata.policyName);
    expect(record.policyType).toBe(execution.metadata.policyType);
    expect(record.priority).toBe(execution.metadata.priority);
    expect(record.state).toBe(execution.instance.state);
    expect(record.metadata).toBe(execution.metadata);
    expect(record.configuration).toBe(execution.configuration);
    expect(record.context).toBe(execution.context);
    expect(record.rules).toBe(execution.rules);
    expect(record.scopes).toBe(execution.scopes);
    expect(record.assignments).toBe(execution.assignments);
    expect(record.history).toBe(execution.history);
    expect(record.auditTrail).toBe(execution.auditTrail);
    expect(record.logs).toBe(execution.logs);
    expect(record.toExecution()).toBe(execution);
  });
});
