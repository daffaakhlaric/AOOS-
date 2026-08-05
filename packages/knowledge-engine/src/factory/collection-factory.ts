import type { KnowledgeCollection } from "../domain/knowledge-collection.js";
import type { KnowledgeScope } from "../domain/knowledge-scope.js";
import { generateId } from "../utils/id.js";

export interface CreateCollectionInput {
  readonly name: string;
  readonly scope: KnowledgeScope;
  readonly assetIds?: readonly string[];
}

/** Builds a fresh `KnowledgeCollection`. */
export class CollectionFactory {
  create(input: CreateCollectionInput): KnowledgeCollection {
    return {
      id: generateId(),
      name: input.name,
      scope: input.scope,
      assetIds: [...(input.assetIds ?? [])],
      createdAt: new Date().toISOString(),
    };
  }
}
