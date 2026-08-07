import type { KnowledgeValidationConfiguration } from "../domain/knowledge-validation-configuration.js";
import type { KnowledgeValidationDecision } from "../domain/knowledge-validation-decision.js";
import type { KnowledgeValidationPolicy } from "../domain/knowledge-validation-policy.js";
import type { KnowledgeValidationRule } from "../domain/knowledge-validation-rule.js";
import type { KnowledgeValidation } from "../domain/knowledge-validation.js";
import { ValidatorNotFoundException } from "../errors/validator-not-found-exception.js";
import { KnowledgeValidatorRegistryBucket } from "../registry/knowledge-validator-registry-bucket.js";
import type { KnowledgeValidatorRegistry } from "../registry/knowledge-validator-registry.js";

/**
 * "RESOLVER: Validation Resolver, Rule Resolver, Policy Resolver, Configuration
 * Resolver, Decision Resolver." (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md) — the
 * exact 5 resolution dimensions, implemented as 5 method pairs on one class. Every
 * resolve against a Registry bucket is a direct Map lookup by id — "Never scan
 * collections." Policy is NOT a Registry bucket (the spec's 8 buckets do not include
 * POLICY), so the Policy Resolver reads from a dedicated in-memory map instead — a
 * documented judgment call, see docs/005.7M-KNOWLEDGE-VALIDATOR-AI-REPORT.md —
 * "Registry".
 */
export class KnowledgeValidatorResolver {
  private readonly policiesById = new Map<string, KnowledgeValidationPolicy>();

  constructor(private readonly registry: KnowledgeValidatorRegistry) {}

  /* ---- 1. Validation Resolver ---- */
  resolveValidation(validationId: string): KnowledgeValidation {
    const entry = this.tryResolveValidation(validationId);
    if (!entry) {
      throw new ValidatorNotFoundException(
        `No Validation is registered for Validation Id "${validationId}"`,
      );
    }
    return entry;
  }

  tryResolveValidation(validationId: string): KnowledgeValidation | undefined {
    return this.registry.get<KnowledgeValidation>(
      KnowledgeValidatorRegistryBucket.VALIDATION,
      validationId,
    );
  }

  /* ---- 2. Rule Resolver ---- */
  resolveRule(ruleId: string): KnowledgeValidationRule {
    const entry = this.tryResolveRule(ruleId);
    if (!entry) {
      throw new ValidatorNotFoundException(`No Rule is registered for Rule Id "${ruleId}"`);
    }
    return entry;
  }

  tryResolveRule(ruleId: string): KnowledgeValidationRule | undefined {
    return this.registry.get<KnowledgeValidationRule>(
      KnowledgeValidatorRegistryBucket.RULE,
      ruleId,
    );
  }

  resolveRules(ruleIds: readonly string[]): readonly KnowledgeValidationRule[] {
    return ruleIds.map((ruleId) => this.resolveRule(ruleId));
  }

  tryResolveRules(ruleIds: readonly string[]): {
    readonly resolved: readonly KnowledgeValidationRule[];
    readonly missing: readonly string[];
  } {
    const resolved: KnowledgeValidationRule[] = [];
    const missing: string[] = [];
    for (const ruleId of ruleIds) {
      const rule = this.tryResolveRule(ruleId);
      if (rule) {
        resolved.push(rule);
      } else {
        missing.push(ruleId);
      }
    }
    return { resolved, missing };
  }

  /* ---- 3. Policy Resolver ---- */
  registerPolicy(policy: KnowledgeValidationPolicy): KnowledgeValidationPolicy {
    this.policiesById.set(policy.policyId, policy);
    return policy;
  }

  resolvePolicy(policyId: string): KnowledgeValidationPolicy {
    const entry = this.tryResolvePolicy(policyId);
    if (!entry) {
      throw new ValidatorNotFoundException(`No Policy is registered for Policy Id "${policyId}"`);
    }
    return entry;
  }

  tryResolvePolicy(policyId: string): KnowledgeValidationPolicy | undefined {
    return this.policiesById.get(policyId);
  }

  /* ---- 4. Configuration Resolver ---- */
  resolveConfiguration(configurationId: string): KnowledgeValidationConfiguration {
    const entry = this.tryResolveConfiguration(configurationId);
    if (!entry) {
      throw new ValidatorNotFoundException(
        `No Configuration is registered for Configuration Id "${configurationId}"`,
      );
    }
    return entry;
  }

  tryResolveConfiguration(configurationId: string): KnowledgeValidationConfiguration | undefined {
    return this.registry.get<KnowledgeValidationConfiguration>(
      KnowledgeValidatorRegistryBucket.CONFIGURATION,
      configurationId,
    );
  }

  /* ---- 5. Decision Resolver ---- */
  resolveDecision(decisionId: string): KnowledgeValidationDecision {
    const entry = this.tryResolveDecision(decisionId);
    if (!entry) {
      throw new ValidatorNotFoundException(
        `No Decision is registered for Decision Id "${decisionId}"`,
      );
    }
    return entry;
  }

  tryResolveDecision(decisionId: string): KnowledgeValidationDecision | undefined {
    return this.registry.get<KnowledgeValidationDecision>(
      KnowledgeValidatorRegistryBucket.DECISION,
      decisionId,
    );
  }
}
