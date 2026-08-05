import {
  KnowledgeIndexException,
  type KnowledgeIndexExceptionOptions,
} from "./knowledge-index-exception.js";

/** Thrown by `KnowledgeIndexOptimizer` when no `IKnowledgeIndexOptimizer` provider is configured — Optimization is an interface-only integration point in this package. */
export class IndexOptimizationNotSupportedException extends KnowledgeIndexException {
  constructor(message: string, options: KnowledgeIndexExceptionOptions = {}) {
    super(message, options);
  }
}
