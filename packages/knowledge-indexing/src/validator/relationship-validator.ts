import type {
  IKnowledgeIndexValidatorStage,
  KnowledgeIndexValidationInput,
  KnowledgeIndexValidationResult,
} from "./i-knowledge-index-validator.js";

/** Flags a blank `asset.id` — the id the Relationship Index keys every edge on. */
export class RelationshipValidator implements IKnowledgeIndexValidatorStage {
  readonly name = "relationships";

  validate(input: KnowledgeIndexValidationInput): KnowledgeIndexValidationResult {
    if (input.asset.id.trim().length === 0) {
      return {
        valid: false,
        issues: [{ path: "asset.id", message: "Asset id must not be blank" }],
      };
    }
    return { valid: true, issues: [] };
  }
}
