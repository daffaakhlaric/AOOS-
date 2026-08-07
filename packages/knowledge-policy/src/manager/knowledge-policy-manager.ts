import type { KnowledgePolicyExecution } from "../domain/knowledge-policy-execution.js";
import { KnowledgePolicyRegistryBucket } from "../registry/knowledge-policy-registry-bucket.js";
import type { KnowledgePolicyRegistry } from "../registry/knowledge-policy-registry.js";
import type { PolicyRegistryEntry } from "../registry/policy-registry-entry.js";
import type { KnowledgePolicySession } from "../session/knowledge-policy-session.js";
import { KnowledgePolicyStatistics } from "../statistics/knowledge-policy-statistics.js";

/**
 * "KnowledgePolicyManager" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md — "Public API") —
 * mid-level orchestrator composing Registry + Session + Statistics + executionsByToken.
 */
export class KnowledgePolicyManager {
  private readonly executionsByToken = new Map<string, KnowledgePolicyExecution>();
  readonly statistics = new KnowledgePolicyStatistics();

  constructor(
    readonly registry: KnowledgePolicyRegistry,
    readonly session: KnowledgePolicySession,
  ) {}

  register(token: string, execution: KnowledgePolicyExecution, entry: PolicyRegistryEntry): void {
    this.registry.register(KnowledgePolicyRegistryBucket.POLICY, entry);
    this.executionsByToken.set(token, execution);
    this.statistics.recordCreated(execution.metadata.policyType);
  }

  get(token: string): KnowledgePolicyExecution | undefined {
    return this.executionsByToken.get(token);
  }

  require(token: string): KnowledgePolicyExecution {
    const execution = this.get(token);
    if (!execution) {
      throw new Error(`No execution registered for token "${token}"`);
    }
    return execution;
  }

  update(token: string, execution: KnowledgePolicyExecution): void {
    if (!this.executionsByToken.has(token)) {
      throw new Error(`No execution registered for token "${token}"`);
    }
    this.executionsByToken.set(token, execution);
  }

  unregister(token: string): boolean {
    const execution = this.executionsByToken.get(token);
    if (!execution) {
      return false;
    }
    this.registry.remove(KnowledgePolicyRegistryBucket.POLICY, execution.metadata.policyId);
    this.executionsByToken.delete(token);
    return true;
  }

  list(): readonly KnowledgePolicyExecution[] {
    return Array.from(this.executionsByToken.values());
  }

  count(): number {
    return this.executionsByToken.size;
  }
}
