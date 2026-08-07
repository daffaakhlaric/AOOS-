import {
  KnowledgeVersionException,
  type KnowledgeVersionExceptionOptions,
} from "./knowledge-version-exception.js";

/** Thrown by `KnowledgeVersioning` when a Version Operation is not permitted by the version's configuration (e.g. rollback with allowRollback=false, merge with allowMerge=false) or targets an unpublishable state. */
export class VersionOperationException extends KnowledgeVersionException {
  constructor(message: string, options: KnowledgeVersionExceptionOptions = {}) {
    super(message, options);
  }
}
