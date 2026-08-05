import {
  KnowledgeProviderException,
  type KnowledgeProviderExceptionOptions,
} from "./knowledge-provider-exception.js";

/** Thrown when `KnowledgeProviderResolver` finds no Provider registered under a requested Category. */
export class CategoryNotFoundException extends KnowledgeProviderException {
  constructor(message: string, options: KnowledgeProviderExceptionOptions = {}) {
    super(message, options);
  }
}
