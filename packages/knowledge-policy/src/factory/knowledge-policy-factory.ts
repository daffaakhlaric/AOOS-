import type { KnowledgePolicyAction } from "../domain/knowledge-policy-action.js";
import type { KnowledgePolicyAssignment } from "../domain/knowledge-policy-assignment.js";
import type { KnowledgePolicyCondition } from "../domain/knowledge-policy-condition.js";
import type { KnowledgePolicyConfigurationRecord } from "../domain/knowledge-policy-configuration-record.js";
import type { KnowledgePolicyMetadata } from "../domain/knowledge-policy-metadata.js";
import type { KnowledgePolicyRuleType } from "../domain/knowledge-policy-rule-type.js";
import type { KnowledgePolicyRule } from "../domain/knowledge-policy-rule.js";
import type { KnowledgePolicyScopeType } from "../domain/knowledge-policy-scope-type.js";
import type { KnowledgePolicyScope } from "../domain/knowledge-policy-scope.js";
import type { KnowledgePolicyType } from "../domain/knowledge-policy-type.js";
import { generateId } from "../utils/id.js";

class PolicyMetadataFactory {
  create(input: {
    policyId: string;
    policyName: string;
    policyType: KnowledgePolicyType;
    tenantId: string;
    policyDescription?: string;
    priority?: number;
    workspaceId?: string;
    labels?: readonly string[];
    tags?: readonly string[];
    createdBy?: string;
  }): KnowledgePolicyMetadata {
    const now = new Date().toISOString();
    return {
      policyId: input.policyId,
      policyName: input.policyName,
      policyDescription: input.policyDescription,
      policyType: input.policyType,
      priority: input.priority ?? 0,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      labels: [...(input.labels ?? [])],
      tags: [...(input.tags ?? [])],
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
  }
}

class PolicyRuleFactory {
  create(input: {
    policyId: string;
    name: string;
    ruleType: KnowledgePolicyRuleType;
    priority?: number;
    description?: string;
    conditions?: readonly string[];
    actions?: readonly string[];
    enabled?: boolean;
    metadata?: Readonly<Record<string, unknown>>;
  }): KnowledgePolicyRule {
    return {
      id: generateId(),
      policyId: input.policyId,
      name: input.name,
      description: input.description,
      ruleType: input.ruleType,
      priority: input.priority ?? 0,
      conditions: [...(input.conditions ?? [])],
      actions: [...(input.actions ?? [])],
      enabled: input.enabled ?? true,
      metadata: { ...input.metadata },
    };
  }
}

class PolicyScopeFactory {
  create(input: {
    policyId: string;
    scopeType: KnowledgePolicyScopeType;
    scopeId?: string;
    metadata?: Readonly<Record<string, unknown>>;
  }): KnowledgePolicyScope {
    return {
      id: generateId(),
      policyId: input.policyId,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      metadata: { ...input.metadata },
    };
  }
}

class PolicyAssignmentFactory {
  create(input: {
    policyId: string;
    targetType: string;
    targetId: string;
    priority?: number;
    assignedBy?: string;
    metadata?: Readonly<Record<string, unknown>>;
  }): KnowledgePolicyAssignment {
    return {
      id: generateId(),
      policyId: input.policyId,
      targetType: input.targetType,
      targetId: input.targetId,
      priority: input.priority ?? 0,
      assignedBy: input.assignedBy,
      assignedAt: new Date().toISOString(),
      metadata: { ...input.metadata },
    };
  }
}

class PolicyConditionFactory {
  create(input: {
    ruleId: string;
    field: string;
    operator: string;
    value: unknown;
    metadata?: Readonly<Record<string, unknown>>;
  }): KnowledgePolicyCondition {
    return {
      id: generateId(),
      ruleId: input.ruleId,
      field: input.field,
      operator: input.operator,
      value: input.value,
      metadata: { ...input.metadata },
    };
  }
}

class PolicyActionFactory {
  create(input: {
    ruleId: string;
    actionType: string;
    parameters?: Readonly<Record<string, unknown>>;
    metadata?: Readonly<Record<string, unknown>>;
  }): KnowledgePolicyAction {
    return {
      id: generateId(),
      ruleId: input.ruleId,
      actionType: input.actionType,
      parameters: { ...input.parameters },
      metadata: { ...input.metadata },
    };
  }
}

class PolicyConfigurationFactory {
  create(input: {
    policyId: string;
    enforceMode?: "strict" | "permissive" | "audit";
    allowOverride?: boolean;
    maxRules?: number;
    maxAssignments?: number;
    evaluationTimeout?: number;
  }): KnowledgePolicyConfigurationRecord {
    return {
      policyId: input.policyId,
      enforceMode: input.enforceMode ?? "permissive",
      allowOverride: input.allowOverride ?? false,
      maxRules: input.maxRules,
      maxAssignments: input.maxAssignments,
      evaluationTimeout: input.evaluationTimeout,
    };
  }
}

/**
 * "KnowledgePolicyFactory" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md — "Public API") —
 * composes 6 sub-factories as `readonly` fields.
 */
export class KnowledgePolicyFactory {
  readonly metadata = new PolicyMetadataFactory();
  readonly rule = new PolicyRuleFactory();
  readonly scope = new PolicyScopeFactory();
  readonly assignment = new PolicyAssignmentFactory();
  readonly condition = new PolicyConditionFactory();
  readonly action = new PolicyActionFactory();
  readonly configuration = new PolicyConfigurationFactory();
}
