import {
  KnowledgeVersionException,
  type KnowledgeVersionExceptionOptions,
} from "./knowledge-version-exception.js";

/** Thrown when `KnowledgeVersionRegistry`/`KnowledgeVersionManager`/`KnowledgeVersionResolver` has no entry registered for a given id/bucket/token. */
export class VersionNotFoundException extends KnowledgeVersionException {
  constructor(message: string, options: KnowledgeVersionExceptionOptions = {}) {
    super(message, options);
  }
}
