import {
  KnowledgeIndexException,
  type KnowledgeIndexExceptionOptions,
} from "./knowledge-index-exception.js";

/** Thrown by `KnowledgeIndexScheduler` for an illegal scheduling operation (e.g. cancelling a job that does not exist). */
export class IndexScheduleException extends KnowledgeIndexException {
  constructor(message: string, options: KnowledgeIndexExceptionOptions = {}) {
    super(message, options);
  }
}
