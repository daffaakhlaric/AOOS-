import {
  KnowledgeSynchronizationException,
  type KnowledgeSynchronizationExceptionOptions,
} from "./knowledge-synchronization-exception.js";

/** Thrown by `KnowledgeSynchronizationScheduler` when no Schedule entry is registered for a given id. */
export class ScheduleNotFoundException extends KnowledgeSynchronizationException {
  constructor(message: string, options: KnowledgeSynchronizationExceptionOptions = {}) {
    super(message, options);
  }
}
