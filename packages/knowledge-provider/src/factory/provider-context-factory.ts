import {
  createKnowledgeProviderContext,
  type CreateKnowledgeProviderContextInput,
} from "../context/create-knowledge-provider-context.js";
import type { KnowledgeProviderContext } from "../context/knowledge-provider-context.js";

/** Wraps `createKnowledgeProviderContext()` behind the Factory Layer's naming convention. */
export class ProviderContextFactory {
  create(input: CreateKnowledgeProviderContextInput): KnowledgeProviderContext {
    return createKnowledgeProviderContext(input);
  }
}
