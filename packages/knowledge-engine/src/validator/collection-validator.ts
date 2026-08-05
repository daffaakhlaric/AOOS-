import type {
  IKnowledgeValidatorStage,
  KnowledgeValidationInput,
  KnowledgeValidationResult,
} from "./i-knowledge-validator.js";

/** "Collection" — when a Repository is supplied, every `assetIds` entry of the given `KnowledgeCollection` must resolve to a known Asset. */
export class CollectionValidator implements IKnowledgeValidatorStage {
  readonly name = "collection";

  validate(input: KnowledgeValidationInput): KnowledgeValidationResult {
    const issues: KnowledgeValidationResult["issues"][number][] = [];
    const collection = input.collection;
    if (collection && input.repository) {
      for (const assetId of collection.assetIds) {
        if (!input.repository.get(assetId)) {
          issues.push({
            path: `collection.${collection.id}.assetIds`,
            message: `Collection "${collection.id}" references unknown Asset id "${assetId}"`,
          });
        }
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
