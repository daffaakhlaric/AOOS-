import type {
  IKnowledgeSourceValidator,
  KnowledgeSourceValidationInput,
  KnowledgeSourceValidationResult,
} from "../contracts/i-knowledge-source-validator.js";

/** Flags a blank `metadata.sourceName`. */
export class SourceNameValidator implements IKnowledgeSourceValidator {
  readonly name = "sourceName";

  validate(input: KnowledgeSourceValidationInput): KnowledgeSourceValidationResult {
    if (input.metadata.sourceName.trim().length === 0) {
      return {
        valid: false,
        issues: [{ path: "metadata.sourceName", message: "Source sourceName must not be empty" }],
      };
    }
    return { valid: true, issues: [] };
  }
}
