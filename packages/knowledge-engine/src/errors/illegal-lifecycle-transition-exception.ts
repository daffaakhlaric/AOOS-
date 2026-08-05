import { KnowledgeException, type KnowledgeExceptionOptions } from "./knowledge-exception.js";

/** Thrown by `lifecycle/knowledge-lifecycle.ts` when a requested `KnowledgeLifecycleState` transition is not present in `KNOWLEDGE_LIFECYCLE_TRANSITIONS`. */
export class IllegalLifecycleTransitionException extends KnowledgeException {
  constructor(message: string, options: KnowledgeExceptionOptions = {}) {
    super(message, options);
  }
}
