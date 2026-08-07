import { describe, expect, it } from "vitest";

import { KnowledgePolicyRuleType } from "../../src/domain/knowledge-policy-rule-type.js";
import { KnowledgePolicyScopeType } from "../../src/domain/knowledge-policy-scope-type.js";
import { KnowledgePolicyType } from "../../src/domain/knowledge-policy-type.js";
import { KnowledgePolicyFactory } from "../../src/factory/knowledge-policy-factory.js";

describe("KnowledgePolicyFactory.metadata", () => {
  const factory = new KnowledgePolicyFactory();

  it("creates metadata with defaults", () => {
    const metadata = factory.metadata.create({
      policyId: "policy-1",
      policyName: "Test",
      policyType: KnowledgePolicyType.ACCESS,
      tenantId: "tenant-1",
    });
    expect(metadata.priority).toBe(0);
    expect(metadata.labels).toEqual([]);
    expect(metadata.tags).toEqual([]);
    expect(metadata.createdAt).toBe(metadata.updatedAt);
  });

  it("creates metadata honoring overrides", () => {
    const metadata = factory.metadata.create({
      policyId: "policy-1",
      policyName: "Test",
      policyType: KnowledgePolicyType.ACCESS,
      tenantId: "tenant-1",
      priority: 5,
      workspaceId: "workspace-1",
      labels: ["a"],
      tags: ["b"],
      createdBy: "user-1",
      policyDescription: "desc",
    });
    expect(metadata.priority).toBe(5);
    expect(metadata.workspaceId).toBe("workspace-1");
    expect(metadata.labels).toEqual(["a"]);
    expect(metadata.tags).toEqual(["b"]);
    expect(metadata.createdBy).toBe("user-1");
    expect(metadata.updatedBy).toBe("user-1");
    expect(metadata.policyDescription).toBe("desc");
  });
});

describe("KnowledgePolicyFactory.rule", () => {
  const factory = new KnowledgePolicyFactory();

  it("creates a rule with defaults", () => {
    const rule = factory.rule.create({
      policyId: "policy-1",
      name: "Rule 1",
      ruleType: KnowledgePolicyRuleType.ALLOW,
    });
    expect(rule.id).toBeTruthy();
    expect(rule.priority).toBe(0);
    expect(rule.enabled).toBe(true);
    expect(rule.conditions).toEqual([]);
    expect(rule.actions).toEqual([]);
  });

  it("creates a rule honoring overrides", () => {
    const rule = factory.rule.create({
      policyId: "policy-1",
      name: "Rule 1",
      ruleType: KnowledgePolicyRuleType.DENY,
      priority: 3,
      description: "desc",
      conditions: ["c1"],
      actions: ["a1"],
      enabled: false,
      metadata: { key: "value" },
    });
    expect(rule.priority).toBe(3);
    expect(rule.description).toBe("desc");
    expect(rule.conditions).toEqual(["c1"]);
    expect(rule.actions).toEqual(["a1"]);
    expect(rule.enabled).toBe(false);
    expect(rule.metadata).toEqual({ key: "value" });
  });
});

describe("KnowledgePolicyFactory.scope", () => {
  const factory = new KnowledgePolicyFactory();

  it("creates a scope with defaults", () => {
    const scope = factory.scope.create({
      policyId: "policy-1",
      scopeType: KnowledgePolicyScopeType.GLOBAL,
    });
    expect(scope.id).toBeTruthy();
    expect(scope.metadata).toEqual({});
  });

  it("creates a scope honoring overrides", () => {
    const scope = factory.scope.create({
      policyId: "policy-1",
      scopeType: KnowledgePolicyScopeType.WORKSPACE,
      scopeId: "workspace-1",
      metadata: { key: "value" },
    });
    expect(scope.scopeId).toBe("workspace-1");
    expect(scope.metadata).toEqual({ key: "value" });
  });
});

describe("KnowledgePolicyFactory.assignment", () => {
  const factory = new KnowledgePolicyFactory();

  it("creates an assignment with defaults", () => {
    const assignment = factory.assignment.create({
      policyId: "policy-1",
      targetType: "workspace",
      targetId: "workspace-1",
    });
    expect(assignment.id).toBeTruthy();
    expect(assignment.priority).toBe(0);
    expect(assignment.assignedAt).toBeTruthy();
  });

  it("creates an assignment honoring overrides", () => {
    const assignment = factory.assignment.create({
      policyId: "policy-1",
      targetType: "workspace",
      targetId: "workspace-1",
      priority: 2,
      assignedBy: "user-1",
      metadata: { key: "value" },
    });
    expect(assignment.priority).toBe(2);
    expect(assignment.assignedBy).toBe("user-1");
    expect(assignment.metadata).toEqual({ key: "value" });
  });
});

describe("KnowledgePolicyFactory.condition", () => {
  const factory = new KnowledgePolicyFactory();

  it("creates a condition", () => {
    const condition = factory.condition.create({
      ruleId: "rule-1",
      field: "type",
      operator: "equals",
      value: "document",
    });
    expect(condition.id).toBeTruthy();
    expect(condition.field).toBe("type");
    expect(condition.operator).toBe("equals");
    expect(condition.value).toBe("document");
  });
});

describe("KnowledgePolicyFactory.action", () => {
  const factory = new KnowledgePolicyFactory();

  it("creates an action with defaults", () => {
    const action = factory.action.create({
      ruleId: "rule-1",
      actionType: "notify",
    });
    expect(action.id).toBeTruthy();
    expect(action.parameters).toEqual({});
  });

  it("creates an action honoring overrides", () => {
    const action = factory.action.create({
      ruleId: "rule-1",
      actionType: "notify",
      parameters: { channel: "email" },
      metadata: { key: "value" },
    });
    expect(action.parameters).toEqual({ channel: "email" });
    expect(action.metadata).toEqual({ key: "value" });
  });
});

describe("KnowledgePolicyFactory.configuration", () => {
  const factory = new KnowledgePolicyFactory();

  it("creates a configuration with defaults", () => {
    const configuration = factory.configuration.create({ policyId: "policy-1" });
    expect(configuration.enforceMode).toBe("permissive");
    expect(configuration.allowOverride).toBe(false);
  });

  it("creates a configuration honoring overrides", () => {
    const configuration = factory.configuration.create({
      policyId: "policy-1",
      enforceMode: "strict",
      allowOverride: true,
      maxRules: 10,
      maxAssignments: 5,
      evaluationTimeout: 1000,
    });
    expect(configuration.enforceMode).toBe("strict");
    expect(configuration.allowOverride).toBe(true);
    expect(configuration.maxRules).toBe(10);
    expect(configuration.maxAssignments).toBe(5);
    expect(configuration.evaluationTimeout).toBe(1000);
  });
});
