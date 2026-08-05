import type { KnowledgeAsset } from "../domain/knowledge-asset.js";
import {
  KNOWLEDGE_CLASSIFICATION_RANK,
  type KnowledgeClassification,
} from "../domain/knowledge-classification.js";
import { KnowledgePolicyType } from "../domain/knowledge-policy-type.js";
import type { KnowledgePolicy } from "../domain/knowledge-policy.js";
import { scopeContains } from "../domain/knowledge-scope.js";
import { KnowledgeRegistryBucket } from "../registry/knowledge-registry-bucket.js";
import type { KnowledgeRegistry } from "../registry/knowledge-registry.js";

import type { PolicyViolation } from "./policy-violation.js";
import { violation } from "./policy-violation.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * "POLICY ENGINE: Retention, Publishing, Classification, Access, Sharing, Compliance,
 * Validation, Review, Approval, Synchronization Policy." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md).
 * Policies are stored in `KnowledgeRegistry`'s `POLICY` bucket. `rule` is a generic,
 * engine-interpreted config bag — this package defines no policy expression language, so
 * `evaluate()` only understands the specific `rule` fields documented per `KnowledgePolicyType`
 * below; Access/Sharing/Validation/Approval/Synchronization Policies are recognized and
 * scope-matched but their actual enforcement is delegated to `KnowledgePermissionEngine`/
 * `KnowledgeValidator`/a future `IKnowledgeApprover`/`IKnowledgeSynchronizer` — see README
 * "Known Limitations".
 */
export class KnowledgePolicyEngine {
  constructor(private readonly registry: KnowledgeRegistry) {}

  register(policy: KnowledgePolicy): KnowledgePolicy {
    return this.registry.register(KnowledgeRegistryBucket.POLICY, policy);
  }

  get(id: string): KnowledgePolicy | undefined {
    return this.registry.get<KnowledgePolicy>(KnowledgeRegistryBucket.POLICY, id);
  }

  list(): readonly KnowledgePolicy[] {
    return this.registry.list<KnowledgePolicy>(KnowledgeRegistryBucket.POLICY);
  }

  /** Every enabled, registered Policy whose `scope` covers `asset.scope`. */
  applicablePolicies(
    asset: KnowledgeAsset,
    type?: KnowledgePolicyType,
  ): readonly KnowledgePolicy[] {
    return this.list().filter(
      (policy) =>
        policy.enabled &&
        (type === undefined || policy.type === type) &&
        scopeContains(policy.scope, asset.scope),
    );
  }

  /** Evaluates every applicable Policy against `asset`, returning every violation found. */
  evaluate(asset: KnowledgeAsset, type?: KnowledgePolicyType): readonly PolicyViolation[] {
    const violations: PolicyViolation[] = [];
    for (const policy of this.applicablePolicies(asset, type)) {
      violations.push(...this.evaluateOne(policy, asset));
    }
    return violations;
  }

  private evaluateOne(policy: KnowledgePolicy, asset: KnowledgeAsset): readonly PolicyViolation[] {
    switch (policy.type) {
      case KnowledgePolicyType.RETENTION:
        return this.evaluateRetention(policy, asset);
      case KnowledgePolicyType.CLASSIFICATION:
        return this.evaluateClassification(policy, asset);
      case KnowledgePolicyType.COMPLIANCE:
        return this.evaluateCompliance(policy, asset);
      case KnowledgePolicyType.REVIEW:
        return this.evaluateReview(policy, asset);
      default:
        return [];
    }
  }

  private evaluateRetention(
    policy: KnowledgePolicy,
    asset: KnowledgeAsset,
  ): readonly PolicyViolation[] {
    const maxAgeDays = policy.rule["maxAgeDays"];
    if (typeof maxAgeDays !== "number") {
      return [];
    }
    const ageMs = Date.now() - Date.parse(asset.createdAt);
    return ageMs > maxAgeDays * MS_PER_DAY
      ? [violation(policy, asset.id, `Asset exceeds Retention Policy maxAgeDays (${maxAgeDays})`)]
      : [];
  }

  private evaluateClassification(
    policy: KnowledgePolicy,
    asset: KnowledgeAsset,
  ): readonly PolicyViolation[] {
    const maxClassification = policy.rule["maxClassification"] as
      KnowledgeClassification | undefined;
    if (!maxClassification) {
      return [];
    }
    return KNOWLEDGE_CLASSIFICATION_RANK[asset.classification] >
      KNOWLEDGE_CLASSIFICATION_RANK[maxClassification]
      ? [
          violation(
            policy,
            asset.id,
            `Asset classification "${asset.classification}" exceeds Policy maxClassification "${maxClassification}"`,
          ),
        ]
      : [];
  }

  private evaluateCompliance(
    policy: KnowledgePolicy,
    asset: KnowledgeAsset,
  ): readonly PolicyViolation[] {
    const requiredTags = policy.rule["requiredTags"];
    if (!Array.isArray(requiredTags)) {
      return [];
    }
    const missing = requiredTags.filter((tag) => !asset.tags.includes(tag));
    return missing.length > 0
      ? [
          violation(
            policy,
            asset.id,
            `Asset is missing required Compliance tags: ${missing.join(", ")}`,
          ),
        ]
      : [];
  }

  private evaluateReview(
    policy: KnowledgePolicy,
    asset: KnowledgeAsset,
  ): readonly PolicyViolation[] {
    const maxDaysSinceReview = policy.rule["maxDaysSinceReview"];
    if (typeof maxDaysSinceReview !== "number") {
      return [];
    }
    if (!asset.metadata.reviewedAt) {
      return [violation(policy, asset.id, "Asset has never been reviewed")];
    }
    const ageMs = Date.now() - Date.parse(asset.metadata.reviewedAt);
    return ageMs > maxDaysSinceReview * MS_PER_DAY
      ? [
          violation(
            policy,
            asset.id,
            `Asset review is older than maxDaysSinceReview (${maxDaysSinceReview})`,
          ),
        ]
      : [];
  }
}
