import {
  createKnowledgeRuntimeContext,
  type CreateKnowledgeRuntimeContextInput,
} from "../context/create-knowledge-runtime-context.js";
import type { KnowledgeRuntimeContext } from "../context/knowledge-runtime-context.js";

/** Wraps `createKnowledgeRuntimeContext()` behind the Factory Layer's naming convention. */
export class RuntimeContextFactory {
  create(input: CreateKnowledgeRuntimeContextInput): KnowledgeRuntimeContext {
    return createKnowledgeRuntimeContext(input);
  }
}
