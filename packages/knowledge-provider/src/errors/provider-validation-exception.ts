import {
  KnowledgeProviderException,
  type KnowledgeProviderExceptionOptions,
} from "./knowledge-provider-exception.js";

/** Thrown by `KnowledgeProviderPipeline`'s Validation stage when `KnowledgeProviderValidator` reports one or more issues. */
export class ProviderValidationException extends KnowledgeProviderException {
  constructor(message: string, options: KnowledgeProviderExceptionOptions = {}) {
    super(message, options);
  }
}
