import { KnowledgeException, type KnowledgeExceptionOptions } from "./knowledge-exception.js";

/** Thrown by `validator/`'s Validation Pipeline (`KnowledgeValidator`) when it rejects a `KnowledgeAsset`. */
export class KnowledgeValidationException extends KnowledgeException {
  constructor(message: string, options: KnowledgeExceptionOptions = {}) {
    super(message, options);
  }
}
