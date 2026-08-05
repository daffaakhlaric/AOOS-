import {
  KnowledgeIndexException,
  type KnowledgeIndexExceptionOptions,
} from "./knowledge-index-exception.js";

/** Thrown by `KnowledgeIndexBuilder` when an Index Entry cannot be built for the given `KnowledgeIndexType`. */
export class IndexBuildException extends KnowledgeIndexException {
  constructor(message: string, options: KnowledgeIndexExceptionOptions = {}) {
    super(message, options);
  }
}
