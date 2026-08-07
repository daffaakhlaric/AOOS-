import type {
  EmbeddingValidatorStageIssue,
  EmbeddingValidatorStageResult,
  IEmbeddingValidatorStage,
  EmbeddingValidatorValidationInput,
} from "../contracts/i-embedding-validator.js";
import { isModelCompatibleWithProvider } from "../domain/embedding-model-catalog.js";

/**
 * Stage 4 — Model: pre-flight well-formedness of the Request's declared `modelName`, and
 * a Model/Provider compatibility cross-check against the built-in catalog. Distinct from
 * the Pipeline's own Model Resolution stage (Pipeline stage 3), which performs the
 * actual Registry lookup and the equivalent cross-check against the RESOLVED Provider —
 * this stage only checks the field shape declared on the Request.
 */
export class ModelValidator implements IEmbeddingValidatorStage {
  readonly name = "model";

  validate(input: EmbeddingValidatorValidationInput): EmbeddingValidatorStageResult {
    const issues: EmbeddingValidatorStageIssue[] = [];
    if (!input.request.modelName) {
      issues.push({ path: "request.modelName", message: "Request modelName must be declared" });
    } else if (
      !isModelCompatibleWithProvider(input.request.modelName, input.request.providerType)
    ) {
      issues.push({
        path: "request.modelName",
        message: `Model "${input.request.modelName}" is not compatible with Provider "${input.request.providerType}"`,
      });
    }
    if (input.resolvedModel && !input.resolvedModel.active) {
      issues.push({
        path: "resolvedModel.active",
        message: `Model "${input.resolvedModel.modelId}" is not active`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
