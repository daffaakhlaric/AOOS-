import {
  KnowledgeRuntimeException,
  type KnowledgeRuntimeExceptionOptions,
} from "./knowledge-runtime-exception.js";

/** Thrown by `KnowledgeRuntimeSession` for an illegal Session operation (e.g. renewing a Session that is already closed/destroyed). */
export class RuntimeSessionException extends KnowledgeRuntimeException {
  constructor(message: string, options: KnowledgeRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
