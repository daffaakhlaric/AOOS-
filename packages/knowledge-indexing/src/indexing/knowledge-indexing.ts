import type { KnowledgeIndexingConfig } from "../config/knowledge-indexing-config.js";
import type { KnowledgeIndexContext } from "../context/knowledge-index-context.js";
import type { KnowledgeIndexEntry } from "../domain/knowledge-index-entry.js";
import type { KnowledgeIndexEvents } from "../events/knowledge-index-events.js";
import { KnowledgeIndexFactory } from "../factory/knowledge-index-factory.js";
import type { KnowledgeIndexHealthReport } from "../health/i-health-check.js";
import { KnowledgeIndexer } from "../indexer/knowledge-indexer.js";
import type { IndexAssetInput } from "../indexer/knowledge-indexer.js";
import { KnowledgeIndexManager } from "../manager/knowledge-index-manager.js";
import type { KnowledgeIndexMetricsSnapshot } from "../metrics/i-knowledge-index-metrics.js";
import { KnowledgeIndexMetrics } from "../metrics/knowledge-index-metrics.js";
import type { KnowledgeIndexDashboard } from "../monitoring/knowledge-index-monitor.js";
import { KnowledgeIndexMonitor } from "../monitoring/knowledge-index-monitor.js";
import { KnowledgeIndexOptimizer } from "../optimizer/knowledge-index-optimizer.js";
import { KnowledgeIndexResolver } from "../resolver/knowledge-index-resolver.js";
import { KnowledgeIndexValidator } from "../validator/knowledge-index-validator.js";

export interface KnowledgeIndexingOptions {
  readonly events: KnowledgeIndexEvents;
  readonly config?: KnowledgeIndexingConfig;
}

/**
 * "Create a vendor-neutral Enterprise Knowledge Indexing Engine. The package prepares
 * searchable indexes for future retrieval." (docs/PROMPT-005.7C-KNOWLEDGE-INDEXING.md) —
 * the public façade. Composes Manager/Indexer/Resolver/Optimizer/Factory/Validator/
 * Metrics/Health/Monitor behind one entry point.
 */
export class KnowledgeIndexing {
  readonly manager = new KnowledgeIndexManager();
  readonly factory = new KnowledgeIndexFactory();
  readonly validator = new KnowledgeIndexValidator();
  readonly resolver: KnowledgeIndexResolver;
  readonly optimizer: KnowledgeIndexOptimizer;
  readonly indexer: KnowledgeIndexer;
  private readonly metricsCollector = new KnowledgeIndexMetrics();
  private readonly monitor: KnowledgeIndexMonitor;

  constructor(options: KnowledgeIndexingOptions) {
    this.resolver = new KnowledgeIndexResolver(this.manager.registry);
    this.optimizer = new KnowledgeIndexOptimizer(options.config?.optimizerProvider);
    this.monitor = new KnowledgeIndexMonitor(this.metricsCollector, this.manager.registry);
    this.indexer = new KnowledgeIndexer(
      this.validator,
      this.manager,
      this.metricsCollector,
      options.events,
      {
        permissionChecker: options.config?.permissionChecker,
        policyChecker: options.config?.policyChecker,
      },
    );
  }

  async indexAsset(input: IndexAssetInput): Promise<readonly KnowledgeIndexEntry[]> {
    return this.indexer.indexAsset(input);
  }

  async reindexAsset(input: IndexAssetInput): Promise<readonly KnowledgeIndexEntry[]> {
    return this.indexer.reindexAsset(input);
  }

  async removeAsset(assetId: string, context: KnowledgeIndexContext): Promise<number> {
    return this.indexer.removeAsset(assetId, context);
  }

  getEntry(id: string): KnowledgeIndexEntry | undefined {
    return this.manager.getEntry(id);
  }

  requireEntry(id: string): KnowledgeIndexEntry {
    return this.manager.requireEntry(id);
  }

  listByAsset(assetId: string): readonly KnowledgeIndexEntry[] {
    return this.manager.listByAsset(assetId);
  }

  health(): KnowledgeIndexHealthReport {
    return this.monitor.health.check();
  }

  metrics(): KnowledgeIndexMetricsSnapshot {
    return this.monitor.sample().metrics;
  }

  monitorSnapshot(): KnowledgeIndexDashboard {
    return this.monitor.sample();
  }
}
