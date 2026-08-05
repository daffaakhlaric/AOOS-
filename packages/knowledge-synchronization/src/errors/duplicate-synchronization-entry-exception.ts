import {
  KnowledgeSynchronizationException,
  type KnowledgeSynchronizationExceptionOptions,
} from "./knowledge-synchronization-exception.js";

/** Thrown when `KnowledgeSynchronizationRegistry.register()` is called with an id already registered in that bucket. */
export class DuplicateSynchronizationEntryException extends KnowledgeSynchronizationException {
  constructor(message: string, options: KnowledgeSynchronizationExceptionOptions = {}) {
    super(message, options);
  }
}
