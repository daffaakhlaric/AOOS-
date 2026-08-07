import {
  EMPTY_KNOWLEDGE_POLICY_STATISTICS,
  type KnowledgePolicyStatisticsSnapshot,
} from "../domain/knowledge-policy-statistics-snapshot.js";
import type { KnowledgePolicyType } from "../domain/knowledge-policy-type.js";

/**
 * "KnowledgePolicyStatistics" (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md — "Public API") —
 * per-`KnowledgePolicyType` bookkeeping.
 */
export class KnowledgePolicyStatistics {
  private readonly statsByType = new Map<KnowledgePolicyType, KnowledgePolicyStatisticsSnapshot>();

  get(policyType: KnowledgePolicyType): KnowledgePolicyStatisticsSnapshot {
    return this.statsByType.get(policyType) ?? EMPTY_KNOWLEDGE_POLICY_STATISTICS;
  }

  recordCreated(policyType: KnowledgePolicyType): KnowledgePolicyStatisticsSnapshot {
    const current = this.get(policyType);
    const snapshot: KnowledgePolicyStatisticsSnapshot = {
      createdCount: current.createdCount + 1,
      activatedCount: current.activatedCount,
      lastActivityAt: new Date().toISOString(),
    };
    this.statsByType.set(policyType, snapshot);
    return snapshot;
  }

  recordActivated(policyType: KnowledgePolicyType): KnowledgePolicyStatisticsSnapshot {
    const current = this.get(policyType);
    const snapshot: KnowledgePolicyStatisticsSnapshot = {
      createdCount: current.createdCount,
      activatedCount: current.activatedCount + 1,
      lastActivityAt: new Date().toISOString(),
    };
    this.statsByType.set(policyType, snapshot);
    return snapshot;
  }
}
