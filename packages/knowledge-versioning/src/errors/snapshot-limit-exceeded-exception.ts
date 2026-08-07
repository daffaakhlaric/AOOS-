import {
  KnowledgeVersionException,
  type KnowledgeVersionExceptionOptions,
} from "./knowledge-version-exception.js";

/** Thrown by `KnowledgeVersioning#snapshotVersion()` when the version's configured `maxSnapshots` budget is exhausted. */
export class SnapshotLimitExceededException extends KnowledgeVersionException {
  constructor(message: string, options: KnowledgeVersionExceptionOptions = {}) {
    super(message, options);
  }
}
