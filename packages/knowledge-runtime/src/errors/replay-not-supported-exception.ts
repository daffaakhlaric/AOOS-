import {
  KnowledgeRuntimeException,
  type KnowledgeRuntimeExceptionOptions,
} from "./knowledge-runtime-exception.js";

/** Thrown by `KnowledgeRuntime.replay()` when no `IKnowledgeRuntimeReplay` provider is configured — Replay is an interface-only integration point in this package. */
export class ReplayNotSupportedException extends KnowledgeRuntimeException {
  constructor(message: string, options: KnowledgeRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
