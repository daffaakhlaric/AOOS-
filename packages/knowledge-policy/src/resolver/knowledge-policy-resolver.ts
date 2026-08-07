import type { KnowledgePolicyAssignment } from "../domain/knowledge-policy-assignment.js";
import type { KnowledgePolicyEvaluation } from "../domain/knowledge-policy-evaluation.js";
import type { KnowledgePolicyRule } from "../domain/knowledge-policy-rule.js";
import type { KnowledgePolicyScope } from "../domain/knowledge-policy-scope.js";
import { PolicyNotFoundException } from "../errors/policy-not-found-exception.js";
import { KnowledgePolicyRegistryBucket } from "../registry/knowledge-policy-registry-bucket.js";
import type { KnowledgePolicyRegistry } from "../registry/knowledge-policy-registry.js";
import type { PolicyRegistryEntry } from "../registry/policy-registry-entry.js";

/**
 * "RESOLVER: Policy Resolver, Rule Resolver, Scope Resolver, Assignment Resolver,
 * Evaluation Resolver." (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md) — the exact 5
 * resolution dimensions. Every resolve is a direct Registry bucket lookup by id.
 */
export class KnowledgePolicyResolver {
  constructor(private readonly registry: KnowledgePolicyRegistry) {}

  resolvePolicy(policyId: string): PolicyRegistryEntry {
    const entry = this.tryResolvePolicy(policyId);
    if (!entry) {
      throw new PolicyNotFoundException(`No Policy is registered for Policy Id "${policyId}"`);
    }
    return entry;
  }

  tryResolvePolicy(policyId: string): PolicyRegistryEntry | undefined {
    return this.registry.get<PolicyRegistryEntry>(KnowledgePolicyRegistryBucket.POLICY, policyId);
  }

  resolveRule(ruleId: string): KnowledgePolicyRule {
    const entry = this.tryResolveRule(ruleId);
    if (!entry) {
      throw new PolicyNotFoundException(`No Rule is registered for Rule Id "${ruleId}"`);
    }
    return entry;
  }

  tryResolveRule(ruleId: string): KnowledgePolicyRule | undefined {
    return this.registry.get<KnowledgePolicyRule>(KnowledgePolicyRegistryBucket.RULE, ruleId);
  }

  resolveScope(scopeId: string): KnowledgePolicyScope {
    const entry = this.tryResolveScope(scopeId);
    if (!entry) {
      throw new PolicyNotFoundException(`No Scope is registered for Scope Id "${scopeId}"`);
    }
    return entry;
  }

  tryResolveScope(scopeId: string): KnowledgePolicyScope | undefined {
    return this.registry.get<KnowledgePolicyScope>(KnowledgePolicyRegistryBucket.SCOPE, scopeId);
  }

  resolveAssignment(assignmentId: string): KnowledgePolicyAssignment {
    const entry = this.tryResolveAssignment(assignmentId);
    if (!entry) {
      throw new PolicyNotFoundException(
        `No Assignment is registered for Assignment Id "${assignmentId}"`,
      );
    }
    return entry;
  }

  tryResolveAssignment(assignmentId: string): KnowledgePolicyAssignment | undefined {
    return this.registry.get<KnowledgePolicyAssignment>(
      KnowledgePolicyRegistryBucket.ASSIGNMENT,
      assignmentId,
    );
  }

  resolveEvaluation(evaluationId: string): KnowledgePolicyEvaluation {
    const entry = this.tryResolveEvaluation(evaluationId);
    if (!entry) {
      throw new PolicyNotFoundException(
        `No Evaluation is registered for Evaluation Id "${evaluationId}"`,
      );
    }
    return entry;
  }

  tryResolveEvaluation(evaluationId: string): KnowledgePolicyEvaluation | undefined {
    return this.registry.get<KnowledgePolicyEvaluation>(
      KnowledgePolicyRegistryBucket.EVALUATION,
      evaluationId,
    );
  }
}
