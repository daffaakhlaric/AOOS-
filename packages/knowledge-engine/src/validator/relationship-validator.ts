import type {
  IKnowledgeValidatorStage,
  KnowledgeValidationInput,
  KnowledgeValidationResult,
} from "./i-knowledge-validator.js";

/** "Relationship" — flags a self-referencing edge, and (when a Repository is supplied) a dangling reference to an unknown Asset id. */
export class RelationshipValidator implements IKnowledgeValidatorStage {
  readonly name = "relationship";

  validate(input: KnowledgeValidationInput): KnowledgeValidationResult {
    const issues: KnowledgeValidationResult["issues"][number][] = [];
    const relationship = input.relationship;
    if (relationship) {
      if (relationship.fromAssetId === relationship.toAssetId) {
        issues.push({
          path: "relationship",
          message: `Relationship "${relationship.id}" cannot reference the same Asset on both ends`,
        });
      }
      if (input.repository) {
        if (!input.repository.get(relationship.fromAssetId)) {
          issues.push({
            path: "relationship.fromAssetId",
            message: `Unknown Asset id "${relationship.fromAssetId}"`,
          });
        }
        if (!input.repository.get(relationship.toAssetId)) {
          issues.push({
            path: "relationship.toAssetId",
            message: `Unknown Asset id "${relationship.toAssetId}"`,
          });
        }
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
