import {
  KnowledgeSynchronizationException,
  type KnowledgeSynchronizationExceptionOptions,
} from "./knowledge-synchronization-exception.js";

/** Thrown by `KnowledgeSynchronizationPolicy` when a registered Policy rejects a Job/Context pair. */
export class SynchronizationPolicyViolationException extends KnowledgeSynchronizationException {
  constructor(message: string, options: KnowledgeSynchronizationExceptionOptions = {}) {
    super(message, options);
  }
}
