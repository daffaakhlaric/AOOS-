import type {
  IKnowledgeValidatorStage,
  KnowledgeValidationInput,
  KnowledgeValidationResult,
} from "./i-knowledge-validator.js";

/** "Schema" — every `requiredFields` entry of the given `KnowledgeSchema` must be present on the Asset's `content` bag. */
export class SchemaValidator implements IKnowledgeValidatorStage {
  readonly name = "schema";

  validate(input: KnowledgeValidationInput): KnowledgeValidationResult {
    const issues: KnowledgeValidationResult["issues"][number][] = [];
    if (input.schema && input.asset) {
      const content = input.asset.content ?? {};
      for (const field of input.schema.requiredFields) {
        if (!(field in content)) {
          issues.push({
            path: `content.${field}`,
            message: `Missing required field "${field}" declared by Schema "${input.schema.id}"`,
          });
        }
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
