import type { KnowledgeAsset, KnowledgeRelationship } from "@aos/knowledge-engine";

import type { KnowledgeIndexContext } from "../context/knowledge-index-context.js";
import type { KnowledgeIndexEntry } from "../domain/knowledge-index-entry.js";
import { KnowledgeIndexType } from "../domain/knowledge-index-type.js";
import { KnowledgeIndexEventType } from "../events/knowledge-index-event-type.js";
import type { KnowledgeIndexEvents } from "../events/knowledge-index-events.js";
import type { KnowledgeIndexManager } from "../manager/knowledge-index-manager.js";
import type { IKnowledgeIndexMetrics } from "../metrics/i-knowledge-index-metrics.js";
import { KnowledgeIndexPipeline } from "../pipeline/knowledge-index-pipeline.js";
import type { KnowledgeIndexPipelineOptions } from "../pipeline/knowledge-index-pipeline.js";
import type { KnowledgeIndexValidator } from "../validator/knowledge-index-validator.js";

export interface IndexAssetInput {
  readonly asset: KnowledgeAsset;
  readonly context: KnowledgeIndexContext;
  readonly indexTypes?: readonly KnowledgeIndexType[];
  readonly relationships?: readonly KnowledgeRelationship[];
}

const DEFAULT_INDEX_TYPES: readonly KnowledgeIndexType[] = Object.values(KnowledgeIndexType).filter(
  (indexType) => indexType !== KnowledgeIndexType.EMBEDDING_REFERENCE,
);

/**
 * "KnowledgeIndexer" (docs/PROMPT-005.7C-KNOWLEDGE-INDEXING.md — "PUBLIC API") — runs the
 * `KnowledgeIndexPipeline` for exactly one `KnowledgeAsset` and publishes the matching
 * `KnowledgeIndexEventType`. `EMBEDDING_REFERENCE` is excluded from the default
 * `indexTypes` list since it requires a caller-supplied `embeddingRef` on
 * `context.metadata` — "Never generate embeddings. Only store references."
 */
export class KnowledgeIndexer {
  private readonly pipeline: KnowledgeIndexPipeline;

  constructor(
    validator: KnowledgeIndexValidator,
    private readonly manager: KnowledgeIndexManager,
    metrics: IKnowledgeIndexMetrics,
    private readonly events: KnowledgeIndexEvents,
    pipelineOptions: KnowledgeIndexPipelineOptions = {},
  ) {
    this.pipeline = new KnowledgeIndexPipeline(
      validator,
      manager.registry,
      metrics,
      pipelineOptions,
    );
  }

  async indexAsset(input: IndexAssetInput): Promise<readonly KnowledgeIndexEntry[]> {
    const indexTypes = input.indexTypes ?? DEFAULT_INDEX_TYPES;
    const alreadyIndexed = this.manager.listByAsset(input.asset.id).length > 0;

    try {
      const entries = await this.pipeline.run({
        asset: input.asset,
        indexTypes,
        context: input.context,
        relationships: input.relationships,
      });
      this.manager.registerEntries(entries);
      await this.events.publishIndexEvent(
        alreadyIndexed ? KnowledgeIndexEventType.UPDATED : KnowledgeIndexEventType.CREATED,
        input.context,
        { assetId: input.asset.id, entryCount: entries.length },
      );
      return entries;
    } catch (error) {
      await this.events.publishIndexEvent(KnowledgeIndexEventType.FAILED, input.context, {
        assetId: input.asset.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async removeAsset(assetId: string, context: KnowledgeIndexContext): Promise<number> {
    const removed = this.manager.removeEntriesForAsset(assetId);
    await this.events.publishIndexEvent(KnowledgeIndexEventType.DELETED, context, {
      assetId,
      removedCount: removed,
    });
    return removed;
  }

  async reindexAsset(input: IndexAssetInput): Promise<readonly KnowledgeIndexEntry[]> {
    this.manager.removeEntriesForAsset(input.asset.id);
    const entries = await this.indexAsset(input);
    await this.events.publishIndexEvent(KnowledgeIndexEventType.REBUILT, input.context, {
      assetId: input.asset.id,
      entryCount: entries.length,
    });
    return entries;
  }
}
