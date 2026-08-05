import type {
  IKnowledgeValidatorStage,
  KnowledgeValidationInput,
  KnowledgeValidationResult,
} from "./i-knowledge-validator.js";

/** "Classification" — an Asset's top-level `classification` must match its `metadata.classification` (the two are set together and must never drift). */
export class ClassificationValidator implements IKnowledgeValidatorStage {
  readonly name = "classification";

  validate(input: KnowledgeValidationInput): KnowledgeValidationResult {
    const issues: KnowledgeValidationResult["issues"][number][] = [];
    const asset = input.asset;
    if (asset && asset.classification !== asset.metadata.classification) {
      issues.push({
        path: "classification",
        message: `Asset classification "${asset.classification}" does not match metadata.classification "${asset.metadata.classification}"`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
