import {
  KnowledgeSynchronizationException,
  type KnowledgeSynchronizationExceptionOptions,
} from "./knowledge-synchronization-exception.js";

/** Thrown when `KnowledgeSynchronizationRegistry`/`KnowledgeSynchronizationManager` has no entry registered for a given id/bucket/token. */
export class SynchronizationNotFoundException extends KnowledgeSynchronizationException {
  constructor(message: string, options: KnowledgeSynchronizationExceptionOptions = {}) {
    super(message, options);
  }
}
