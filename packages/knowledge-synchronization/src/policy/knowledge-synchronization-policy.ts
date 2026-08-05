import type { IKnowledgeSynchronizationConflictResolver } from "../contracts/i-knowledge-synchronization-conflict-resolver.js";
import type { KnowledgeChangeRecord } from "../domain/knowledge-change-record.js";
import type { KnowledgeConflictResolutionStrategy } from "../domain/knowledge-conflict-resolution-strategy.js";
import type { KnowledgeSynchronizationJob } from "../domain/knowledge-synchronization-job.js";
import { ConflictResolutionNotSupportedException } from "../errors/conflict-resolution-not-supported-exception.js";
import { KnowledgeSynchronizationRegistryBucket } from "../registry/knowledge-synchronization-registry-bucket.js";
import type { KnowledgeSynchronizationRegistry } from "../registry/knowledge-synchronization-registry.js";

import type {
  KnowledgeSynchronizationPolicyRecord,
  KnowledgeSynchronizationPolicyViolation,
} from "./knowledge-synchronization-policy-record.js";

/**
 * "KnowledgeSynchronizationPolicy" (docs/PROMPT-005.7E-KNOWLEDGE-SYNCHRONIZATION.md —
 * "PUBLIC API") — evaluates every enabled, scope-matching registered
 * `KnowledgeSynchronizationPolicyRecord` (`KnowledgeSynchronizationRegistry`'s `POLICY`
 * bucket) against a Job's `mode`, and separately dispatches Conflict Resolution —
 * "Create interface-only contracts ... No implementation." — to a registered
 * `IKnowledgeSynchronizationConflictResolver`, owning no resolution algorithm itself
 * (mirrors `@aos/knowledge-retrieval`'s `KnowledgeRankingEngine` dispatch-only pattern).
 * Conflict Resolvers are kept in a private map rather than the Registry — the source
 * prompt's own 8-bucket Registry list has no "Conflict Resolver" bucket.
 */
export class KnowledgeSynchronizationPolicy {
  private readonly conflictResolversByStrategy = new Map<
    KnowledgeConflictResolutionStrategy,
    IKnowledgeSynchronizationConflictResolver
  >();

  constructor(private readonly registry: KnowledgeSynchronizationRegistry) {}

  register(policy: KnowledgeSynchronizationPolicyRecord): KnowledgeSynchronizationPolicyRecord {
    return this.registry.replace(KnowledgeSynchronizationRegistryBucket.POLICY, policy);
  }

  applicablePolicies(
    job: KnowledgeSynchronizationJob,
  ): readonly KnowledgeSynchronizationPolicyRecord[] {
    return this.registry
      .list<KnowledgeSynchronizationPolicyRecord>(KnowledgeSynchronizationRegistryBucket.POLICY)
      .filter(
        (policy) =>
          policy.enabled &&
          policy.scope.tenantId === job.tenantId &&
          (policy.scope.workspaceId === undefined || policy.scope.workspaceId === job.workspaceId),
      );
  }

  evaluate(job: KnowledgeSynchronizationJob): readonly KnowledgeSynchronizationPolicyViolation[] {
    const violations: KnowledgeSynchronizationPolicyViolation[] = [];
    for (const policy of this.applicablePolicies(job)) {
      if (policy.allowedModes && !policy.allowedModes.includes(job.mode)) {
        violations.push({
          policyId: policy.id,
          reason: `Mode "${job.mode}" is not in Policy "${policy.id}"'s allowedModes`,
        });
      }
      if (policy.deniedModes?.includes(job.mode)) {
        violations.push({
          policyId: policy.id,
          reason: `Mode "${job.mode}" is denied by Policy "${policy.id}"`,
        });
      }
    }
    return violations;
  }

  registerConflictResolver(
    resolver: IKnowledgeSynchronizationConflictResolver,
  ): IKnowledgeSynchronizationConflictResolver {
    this.conflictResolversByStrategy.set(resolver.strategy, resolver);
    return resolver;
  }

  isConflictResolutionSupported(strategy: KnowledgeConflictResolutionStrategy): boolean {
    return this.conflictResolversByStrategy.has(strategy);
  }

  async resolveConflicts(
    changes: readonly KnowledgeChangeRecord[],
    strategy?: KnowledgeConflictResolutionStrategy,
  ): Promise<readonly KnowledgeChangeRecord[]> {
    if (!strategy) {
      return changes;
    }
    const resolver = this.conflictResolversByStrategy.get(strategy);
    if (!resolver) {
      throw new ConflictResolutionNotSupportedException(
        `No IKnowledgeSynchronizationConflictResolver is registered for Strategy "${strategy}"`,
      );
    }
    return resolver.resolve(changes);
  }
}
