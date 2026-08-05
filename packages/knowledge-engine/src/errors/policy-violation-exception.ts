import { KnowledgeException, type KnowledgeExceptionOptions } from "./knowledge-exception.js";

/** Thrown by `policy/knowledge-policy-engine.ts` when a `KnowledgeAsset` violates an evaluated `KnowledgePolicy`. */
export class PolicyViolationException extends KnowledgeException {
  constructor(message: string, options: KnowledgeExceptionOptions = {}) {
    super(message, options);
  }
}
