import {
  KnowledgeIndexException,
  type KnowledgeIndexExceptionOptions,
} from "./knowledge-index-exception.js";

/** Thrown when `ConsistencyValidator` detects an Index Entry that disagrees with its own source Knowledge Asset (e.g. stale version). */
export class IndexConsistencyException extends KnowledgeIndexException {
  constructor(message: string, options: KnowledgeIndexExceptionOptions = {}) {
    super(message, options);
  }
}
