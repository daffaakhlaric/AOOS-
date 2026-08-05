import type {
  IKnowledgeIndexValidatorStage,
  KnowledgeIndexValidationInput,
  KnowledgeIndexValidationResult,
} from "./i-knowledge-index-validator.js";

/** Flags a caller-supplied `indexTypes` list containing the same `KnowledgeIndexType` more than once — building it twice would trip `KnowledgeIndexRegistry`'s own duplicate-id guard downstream. */
export class DuplicateValidator implements IKnowledgeIndexValidatorStage {
  readonly name = "duplicate";

  validate(input: KnowledgeIndexValidationInput): KnowledgeIndexValidationResult {
    const unique = new Set(input.indexTypes);
    if (unique.size !== input.indexTypes.length) {
      return {
        valid: false,
        issues: [{ path: "indexTypes", message: "indexTypes must not contain duplicates" }],
      };
    }
    return { valid: true, issues: [] };
  }
}
