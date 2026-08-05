import {
  KnowledgeSynchronizationException,
  type KnowledgeSynchronizationExceptionOptions,
} from "./knowledge-synchronization-exception.js";

/** Thrown by `KnowledgeSynchronizationPipeline`'s Validation stage when `KnowledgeSynchronizationValidator` reports one or more issues. */
export class SynchronizationValidationException extends KnowledgeSynchronizationException {
  constructor(message: string, options: KnowledgeSynchronizationExceptionOptions = {}) {
    super(message, options);
  }
}
