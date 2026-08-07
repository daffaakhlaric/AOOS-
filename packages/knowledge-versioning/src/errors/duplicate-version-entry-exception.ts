import {
  KnowledgeVersionException,
  type KnowledgeVersionExceptionOptions,
} from "./knowledge-version-exception.js";

/** Thrown when a Registry bucket already holds an entry with the same id, or a version id is created twice. */
export class DuplicateVersionEntryException extends KnowledgeVersionException {
  constructor(message: string, options: KnowledgeVersionExceptionOptions = {}) {
    super(message, options);
  }
}
