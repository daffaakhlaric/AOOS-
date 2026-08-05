import { z } from "zod";

/** "KnowledgeChunk" — a pure data shape a future `IKnowledgeChunker` would populate. This package performs no chunking itself. */
export const knowledgeChunkSchema = z.object({
  id: z.string().min(1),
  documentId: z.string().min(1),
  sequence: z.number().int().min(0),
  text: z.string(),
  startOffset: z.number().int().min(0).optional(),
  endOffset: z.number().int().min(0).optional(),
});

export type KnowledgeChunk = z.infer<typeof knowledgeChunkSchema>;
