import type { IKnowledgeIndexOptimizer } from "../contracts/i-knowledge-index-optimizer.js";
import { IndexOptimizationNotSupportedException } from "../errors/index-optimization-not-supported-exception.js";

/**
 * "OPTIMIZER: Interface only. No optimization logic. Prepare Index Merge, Index Split,
 * Compaction, Vacuum, Rebuild." (docs/PROMPT-005.7C-KNOWLEDGE-INDEXING.md) — this class
 * owns no optimization algorithm itself; every operation delegates to an injected
 * `IKnowledgeIndexOptimizer`, throwing `IndexOptimizationNotSupportedException` when none
 * is configured.
 */
export class KnowledgeIndexOptimizer {
  constructor(private readonly provider?: IKnowledgeIndexOptimizer) {}

  async merge(indexType: string): Promise<void> {
    await this.require().merge(indexType);
  }

  async split(indexType: string): Promise<void> {
    await this.require().split(indexType);
  }

  async compact(indexType: string): Promise<void> {
    await this.require().compact(indexType);
  }

  async vacuum(indexType: string): Promise<void> {
    await this.require().vacuum(indexType);
  }

  async rebuild(indexType: string): Promise<void> {
    await this.require().rebuild(indexType);
  }

  private require(): IKnowledgeIndexOptimizer {
    if (!this.provider) {
      throw new IndexOptimizationNotSupportedException(
        "No IKnowledgeIndexOptimizer provider is configured — optimization is an interface-only integration point in this package",
      );
    }
    return this.provider;
  }
}
