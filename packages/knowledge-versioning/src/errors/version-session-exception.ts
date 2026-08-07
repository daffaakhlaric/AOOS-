import {
  KnowledgeVersionException,
  type KnowledgeVersionExceptionOptions,
} from "./knowledge-version-exception.js";

/** Thrown by `KnowledgeVersionSession` when a Session operation targets a missing Session or one in the wrong state. */
export class VersionSessionException extends KnowledgeVersionException {
  constructor(message: string, options: KnowledgeVersionExceptionOptions = {}) {
    super(message, options);
  }
}
