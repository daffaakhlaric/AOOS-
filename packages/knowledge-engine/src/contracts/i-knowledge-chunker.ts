import type { KnowledgeChunk } from "../domain/knowledge-chunk.js";
import type { KnowledgeDocument } from "../domain/knowledge-document.js";

/** "IKnowledgeChunker — No implementation." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md — "EXTENSION POINTS"). Implementation belongs to a future chunking Engineering Task; this package never chunks a Document itself. */
export interface IKnowledgeChunker {
  chunk(document: KnowledgeDocument): Promise<readonly KnowledgeChunk[]>;
}
