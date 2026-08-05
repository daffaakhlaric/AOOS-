import {
  KnowledgeProviderException,
  type KnowledgeProviderExceptionOptions,
} from "./knowledge-provider-exception.js";

/** Thrown when a caller requires a Capability a resolved Provider's `KnowledgeProviderCapabilities` does not declare. */
export class CapabilityNotSupportedException extends KnowledgeProviderException {
  constructor(message: string, options: KnowledgeProviderExceptionOptions = {}) {
    super(message, options);
  }
}
