import type { KnowledgeAsset } from "@aos/knowledge-engine";

import { KnowledgeIndexBuilder } from "../builder/knowledge-index-builder.js";
import {
  createKnowledgeIndexContext,
  type CreateKnowledgeIndexContextInput,
} from "../context/create-knowledge-index-context.js";
import type { KnowledgeIndexContext } from "../context/knowledge-index-context.js";
import type { KnowledgeIndexEntry } from "../domain/knowledge-index-entry.js";
import type { KnowledgeIndexType } from "../domain/knowledge-index-type.js";

/**
 * "KnowledgeIndexFactory" (docs/PROMPT-005.7C-KNOWLEDGE-INDEXING.md — "PUBLIC API") — the
 * façade composing `createKnowledgeIndexContext()` and `KnowledgeIndexBuilder` so a
 * caller can build every requested `KnowledgeIndexType` for one `KnowledgeAsset` in one
 * call, without registering anything (that stays `KnowledgeIndexRegistry`'s job).
 */
export class KnowledgeIndexFactory {
  private readonly builder = new KnowledgeIndexBuilder();

  createContext(input: CreateKnowledgeIndexContextInput): KnowledgeIndexContext {
    return createKnowledgeIndexContext(input);
  }

  createEntries(
    asset: KnowledgeAsset,
    indexTypes: readonly KnowledgeIndexType[],
    context: KnowledgeIndexContext,
  ): readonly KnowledgeIndexEntry[] {
    return indexTypes.flatMap((indexType) => this.builder.build(asset, indexType, context));
  }
}
