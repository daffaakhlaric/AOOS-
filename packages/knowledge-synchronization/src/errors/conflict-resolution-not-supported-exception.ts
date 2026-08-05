import {
  KnowledgeSynchronizationException,
  type KnowledgeSynchronizationExceptionOptions,
} from "./knowledge-synchronization-exception.js";

/** Thrown by `KnowledgeSynchronizationPolicy` when a caller explicitly requires a `KnowledgeConflictResolutionStrategy` and no matching `IKnowledgeSynchronizationConflictResolver` is registered. */
export class ConflictResolutionNotSupportedException extends KnowledgeSynchronizationException {
  constructor(message: string, options: KnowledgeSynchronizationExceptionOptions = {}) {
    super(message, options);
  }
}
