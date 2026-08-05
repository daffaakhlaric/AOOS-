import {
  KnowledgeRuntimeException,
  type KnowledgeRuntimeExceptionOptions,
} from "./knowledge-runtime-exception.js";

/** Thrown when a Snapshot is requested for a `KnowledgeRuntimeToken` with none captured yet. */
export class RuntimeSnapshotException extends KnowledgeRuntimeException {
  constructor(message: string, options: KnowledgeRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
