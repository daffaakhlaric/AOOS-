import {
  KnowledgeRuntimeException,
  type KnowledgeRuntimeExceptionOptions,
} from "./knowledge-runtime-exception.js";

/** Thrown by `PolicyMiddleware` when a configured `IKnowledgeRuntimePolicyChecker` reports a violation. */
export class RuntimePolicyException extends KnowledgeRuntimeException {
  constructor(message: string, options: KnowledgeRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
