import {
  KnowledgeSynchronizationException,
  type KnowledgeSynchronizationExceptionOptions,
} from "./knowledge-synchronization-exception.js";

/** Thrown by the Pipeline's Permission stage when the configured checker rejects a Job/Context pair. */
export class SynchronizationPermissionDeniedException extends KnowledgeSynchronizationException {
  constructor(message: string, options: KnowledgeSynchronizationExceptionOptions = {}) {
    super(message, options);
  }
}
