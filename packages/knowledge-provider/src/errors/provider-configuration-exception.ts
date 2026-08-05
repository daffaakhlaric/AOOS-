import {
  KnowledgeProviderException,
  type KnowledgeProviderExceptionOptions,
} from "./knowledge-provider-exception.js";

/** Thrown by `KnowledgeProviderConfiguration` when a configuration settings object contains a secret-looking key — "NO OAuth. NO Secrets. Only metadata." */
export class ProviderConfigurationException extends KnowledgeProviderException {
  constructor(message: string, options: KnowledgeProviderExceptionOptions = {}) {
    super(message, options);
  }
}
