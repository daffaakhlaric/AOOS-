import {
  KnowledgeRuntimeException,
  type KnowledgeRuntimeExceptionOptions,
} from "./knowledge-runtime-exception.js";

/** Thrown when `KnowledgeRuntimeRegistry` has no `KnowledgeRuntimeInstance` registered for a given `KnowledgeRuntimeToken`. */
export class RuntimeInstanceNotFoundException extends KnowledgeRuntimeException {
  constructor(message: string, options: KnowledgeRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
