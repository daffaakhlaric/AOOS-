import { z } from "zod";

import { knowledgeAssetSchema } from "./knowledge-asset.js";
import { knowledgeChunkSchema } from "./knowledge-chunk.js";

/** "KnowledgeDocument" — a `KnowledgeAsset` specialization carrying document content plus optional `KnowledgeChunk`s (populated by a future `IKnowledgeChunker`, never by this package). */
export const knowledgeDocumentSchema = knowledgeAssetSchema.extend({
  contentType: z.string().optional(),
  chunks: z.array(knowledgeChunkSchema).optional(),
});

export type KnowledgeDocument = z.infer<typeof knowledgeDocumentSchema>;
