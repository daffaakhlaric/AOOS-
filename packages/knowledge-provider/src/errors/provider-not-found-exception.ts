import {
  KnowledgeProviderException,
  type KnowledgeProviderExceptionOptions,
} from "./knowledge-provider-exception.js";

/** Thrown when `KnowledgeProviderRegistry`/`KnowledgeProviderManager` has no entry registered for a given id/bucket/token. */
export class ProviderNotFoundException extends KnowledgeProviderException {
  constructor(message: string, options: KnowledgeProviderExceptionOptions = {}) {
    super(message, options);
  }
}
