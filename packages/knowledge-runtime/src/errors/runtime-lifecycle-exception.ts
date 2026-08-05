import {
  KnowledgeRuntimeException,
  type KnowledgeRuntimeExceptionOptions,
} from "./knowledge-runtime-exception.js";

/** Thrown by `LifecycleMiddleware` when asked to run an unknown lifecycle operation. */
export class RuntimeLifecycleException extends KnowledgeRuntimeException {
  constructor(message: string, options: KnowledgeRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
