import {
  createKnowledgeSourceContext,
  type CreateKnowledgeSourceContextInput,
} from "../context/create-knowledge-source-context.js";
import type { KnowledgeSourceContext } from "../context/knowledge-source-context.js";

/** Wraps `createKnowledgeSourceContext()` behind the Factory Layer's naming convention. */
export class KnowledgeSourceContextFactory {
  create(input: CreateKnowledgeSourceContextInput): KnowledgeSourceContext {
    return createKnowledgeSourceContext(input);
  }
}
