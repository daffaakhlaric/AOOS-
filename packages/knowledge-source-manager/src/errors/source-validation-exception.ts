import {
  KnowledgeSourceException,
  type KnowledgeSourceExceptionOptions,
} from "./knowledge-source-exception.js";

/** Thrown by `KnowledgeSourcePipeline`'s Validation stage when `KnowledgeSourceValidator` reports issues. */
export class SourceValidationException extends KnowledgeSourceException {
  constructor(message: string, options: KnowledgeSourceExceptionOptions = {}) {
    super(message, options);
  }
}
