import type { KnowledgeRelationshipType } from "../domain/knowledge-relationship-type.js";
import type { KnowledgeRelationship } from "../domain/knowledge-relationship.js";
import { InvalidRelationshipException } from "../errors/invalid-relationship-exception.js";
import { generateId } from "../utils/id.js";

export interface CreateRelationshipInput {
  readonly fromAssetId: string;
  readonly toAssetId: string;
  readonly type: KnowledgeRelationshipType;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Builds a fresh `KnowledgeRelationship` — rejects a self-referencing edge (`fromAssetId === toAssetId`) at construction time. */
export class RelationshipFactory {
  create(input: CreateRelationshipInput): KnowledgeRelationship {
    if (input.fromAssetId === input.toAssetId) {
      throw new InvalidRelationshipException(
        `A KnowledgeRelationship cannot reference the same Asset "${input.fromAssetId}" on both ends`,
      );
    }
    return {
      id: generateId(),
      fromAssetId: input.fromAssetId,
      toAssetId: input.toAssetId,
      type: input.type,
      createdAt: new Date().toISOString(),
      metadata: input.metadata,
    };
  }
}
