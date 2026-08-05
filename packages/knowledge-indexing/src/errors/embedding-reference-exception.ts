import {
  KnowledgeIndexException,
  type KnowledgeIndexExceptionOptions,
} from "./knowledge-index-exception.js";

/** Thrown for a malformed `KnowledgeEmbeddingReference` — this package only stores the reference, never generates the embedding itself. */
export class EmbeddingReferenceException extends KnowledgeIndexException {
  constructor(message: string, options: KnowledgeIndexExceptionOptions = {}) {
    super(message, options);
  }
}
