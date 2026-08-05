import {
  KnowledgeProviderException,
  type KnowledgeProviderExceptionOptions,
} from "./knowledge-provider-exception.js";

/** Thrown by `KnowledgeProviderSession` for an illegal Session operation. */
export class ProviderSessionException extends KnowledgeProviderException {
  constructor(message: string, options: KnowledgeProviderExceptionOptions = {}) {
    super(message, options);
  }
}
