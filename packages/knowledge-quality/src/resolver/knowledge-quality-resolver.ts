import type { KnowledgeQualityAssessment } from "../domain/knowledge-quality-assessment.js";
import type { KnowledgeQualityConfiguration } from "../domain/knowledge-quality-configuration.js";
import type { KnowledgeQualityPolicy } from "../domain/knowledge-quality-policy.js";
import type { KnowledgeQualityProfile } from "../domain/knowledge-quality-profile.js";
import type { KnowledgeQualityRule } from "../domain/knowledge-quality-rule.js";
import { QualityNotFoundException } from "../errors/quality-not-found-exception.js";
import { KnowledgeQualityRegistryBucket } from "../registry/knowledge-quality-registry-bucket.js";
import type { KnowledgeQualityRegistry } from "../registry/knowledge-quality-registry.js";

/**
 * "RESOLVER: Assessment Resolver, Rule Resolver, Profile Resolver, Policy Resolver,
 * Configuration Resolver." (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md) — the exact 5
 * resolution dimensions, implemented as 5 method pairs on one class. Every resolve
 * against a Registry bucket is a direct Map lookup by id — "Never scan collections."
 * Policy is NOT a Registry bucket (the spec's 8 buckets do not include POLICY), so the
 * Policy Resolver reads from a dedicated in-memory map instead — a documented judgment
 * call, see docs/005.7L-KNOWLEDGE-QUALITY-ENGINE-REPORT.md — "Registry".
 */
export class KnowledgeQualityResolver {
  private readonly policiesById = new Map<string, KnowledgeQualityPolicy>();

  constructor(private readonly registry: KnowledgeQualityRegistry) {}

  /* ---- 1. Assessment Resolver ---- */
  resolveAssessment(assessmentId: string): KnowledgeQualityAssessment {
    const entry = this.tryResolveAssessment(assessmentId);
    if (!entry) {
      throw new QualityNotFoundException(
        `No Assessment is registered for Assessment Id "${assessmentId}"`,
      );
    }
    return entry;
  }

  tryResolveAssessment(assessmentId: string): KnowledgeQualityAssessment | undefined {
    return this.registry.get<KnowledgeQualityAssessment>(
      KnowledgeQualityRegistryBucket.ASSESSMENT,
      assessmentId,
    );
  }

  /* ---- 2. Rule Resolver ---- */
  resolveRule(ruleId: string): KnowledgeQualityRule {
    const entry = this.tryResolveRule(ruleId);
    if (!entry) {
      throw new QualityNotFoundException(`No Rule is registered for Rule Id "${ruleId}"`);
    }
    return entry;
  }

  tryResolveRule(ruleId: string): KnowledgeQualityRule | undefined {
    return this.registry.get<KnowledgeQualityRule>(KnowledgeQualityRegistryBucket.RULE, ruleId);
  }

  resolveRules(ruleIds: readonly string[]): readonly KnowledgeQualityRule[] {
    return ruleIds.map((ruleId) => this.resolveRule(ruleId));
  }

  tryResolveRules(ruleIds: readonly string[]): {
    readonly resolved: readonly KnowledgeQualityRule[];
    readonly missing: readonly string[];
  } {
    const resolved: KnowledgeQualityRule[] = [];
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

  /* ---- 3. Profile Resolver ---- */
  resolveProfile(profileId: string): KnowledgeQualityProfile {
    const entry = this.tryResolveProfile(profileId);
    if (!entry) {
      throw new QualityNotFoundException(`No Profile is registered for Profile Id "${profileId}"`);
    }
    return entry;
  }

  tryResolveProfile(profileId: string): KnowledgeQualityProfile | undefined {
    return this.registry.get<KnowledgeQualityProfile>(
      KnowledgeQualityRegistryBucket.PROFILE,
      profileId,
    );
  }

  /* ---- 4. Policy Resolver ---- */
  registerPolicy(policy: KnowledgeQualityPolicy): KnowledgeQualityPolicy {
    this.policiesById.set(policy.policyId, policy);
    return policy;
  }

  resolvePolicy(policyId: string): KnowledgeQualityPolicy {
    const entry = this.tryResolvePolicy(policyId);
    if (!entry) {
      throw new QualityNotFoundException(`No Policy is registered for Policy Id "${policyId}"`);
    }
    return entry;
  }

  tryResolvePolicy(policyId: string): KnowledgeQualityPolicy | undefined {
    return this.policiesById.get(policyId);
  }

  /* ---- 5. Configuration Resolver ---- */
  resolveConfiguration(configurationId: string): KnowledgeQualityConfiguration {
    const entry = this.tryResolveConfiguration(configurationId);
    if (!entry) {
      throw new QualityNotFoundException(
        `No Configuration is registered for Configuration Id "${configurationId}"`,
      );
    }
    return entry;
  }

  tryResolveConfiguration(configurationId: string): KnowledgeQualityConfiguration | undefined {
    return this.registry.get<KnowledgeQualityConfiguration>(
      KnowledgeQualityRegistryBucket.CONFIGURATION,
      configurationId,
    );
  }
}
