import {
  createKnowledgeQueryContext,
  type CreateKnowledgeQueryContextInput,
} from "../context/create-knowledge-query-context.js";
import type { KnowledgeQueryContext } from "../context/knowledge-query-context.js";

/** Wraps `createKnowledgeQueryContext()` behind the Factory Layer's naming convention. */
export class KnowledgeSearchContextFactory {
  create(input: CreateKnowledgeQueryContextInput): KnowledgeQueryContext {
    return createKnowledgeQueryContext(input);
  }
}
