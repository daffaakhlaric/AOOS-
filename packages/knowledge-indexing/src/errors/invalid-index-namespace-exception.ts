import {
  KnowledgeIndexException,
  type KnowledgeIndexExceptionOptions,
} from "./knowledge-index-exception.js";

/** Thrown when an Index Entry references a malformed `knowledge://` namespace URI. */
export class InvalidIndexNamespaceException extends KnowledgeIndexException {
  constructor(message: string, options: KnowledgeIndexExceptionOptions = {}) {
    super(message, options);
  }
}
