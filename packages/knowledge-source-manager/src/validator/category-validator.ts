import type {
  IKnowledgeSourceValidator,
  KnowledgeSourceValidationInput,
  KnowledgeSourceValidationResult,
} from "../contracts/i-knowledge-source-validator.js";

/** Flags a `metadata.sourceCategory` that is not a member of `KnowledgeSourceCategory`. */
export class CategoryValidator implements IKnowledgeSourceValidator {
  readonly name = "category";

  validate(input: KnowledgeSourceValidationInput): KnowledgeSourceValidationResult {
    if (!input.metadata.sourceCategory) {
      return {
        valid: false,
        issues: [{ path: "metadata.sourceCategory", message: "Source sourceCategory is required" }],
      };
    }
    return { valid: true, issues: [] };
  }
}
