import { KnowledgeException, type KnowledgeExceptionOptions } from "./knowledge-exception.js";

/** Thrown by `namespace/knowledge-namespace.ts` when a `knowledge://` URI cannot be parsed or does not resolve every required hierarchical segment. */
export class InvalidNamespaceException extends KnowledgeException {
  constructor(message: string, options: KnowledgeExceptionOptions = {}) {
    super(message, options);
  }
}
