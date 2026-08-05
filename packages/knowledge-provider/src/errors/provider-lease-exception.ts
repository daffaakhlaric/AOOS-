import {
  KnowledgeProviderException,
  type KnowledgeProviderExceptionOptions,
} from "./knowledge-provider-exception.js";

/** Thrown by `KnowledgeProviderSession` when a Lease cannot be renewed (already expired). */
export class ProviderLeaseException extends KnowledgeProviderException {
  constructor(message: string, options: KnowledgeProviderExceptionOptions = {}) {
    super(message, options);
  }
}
