import {
  createKnowledgeSynchronizationContext,
  type CreateKnowledgeSynchronizationContextInput,
} from "../context/create-knowledge-synchronization-context.js";
import type { KnowledgeSynchronizationContext } from "../context/knowledge-synchronization-context.js";

/** Wraps `createKnowledgeSynchronizationContext()` behind the Factory Layer's naming convention. */
export class SynchronizationContextFactory {
  create(input: CreateKnowledgeSynchronizationContextInput): KnowledgeSynchronizationContext {
    return createKnowledgeSynchronizationContext(input);
  }
}
