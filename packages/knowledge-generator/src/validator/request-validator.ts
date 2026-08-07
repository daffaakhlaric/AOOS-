import type {
  GeneratorValidationIssue,
  GeneratorValidationResult,
  IKnowledgeGeneratorValidator,
  KnowledgeGeneratorValidationInput,
} from "../contracts/i-knowledge-generator-validator.js";
import { KnowledgeGenerationAssetType } from "../domain/knowledge-generation-asset-type.js";
import { KnowledgeGenerationMode } from "../domain/knowledge-generation-mode.js";

const VALID_ASSET_TYPES = new Set<string>(Object.values(KnowledgeGenerationAssetType));
const VALID_MODES = new Set<string>(Object.values(KnowledgeGenerationMode));

/** Stage 3 — Request: requestId blank, requestedBy blank, and Knowledge Type / Generation Mode must be one of the enumerated values. */
export class RequestValidator implements IKnowledgeGeneratorValidator {
  readonly name = "request";

  validate(input: KnowledgeGeneratorValidationInput): GeneratorValidationResult {
    const issues: GeneratorValidationIssue[] = [];
    if (input.request.requestId.trim().length === 0) {
      issues.push({ path: "request.requestId", message: "Request requestId must not be empty" });
    }
    if (input.request.requestedBy.trim().length === 0) {
      issues.push({
        path: "request.requestedBy",
        message: "Request requestedBy must not be empty",
      });
    }
    if (!VALID_ASSET_TYPES.has(input.request.assetType)) {
      issues.push({
        path: "request.assetType",
        message: "Request assetType must be a known Knowledge Type",
      });
    }
    if (!VALID_MODES.has(input.request.mode)) {
      issues.push({
        path: "request.mode",
        message: "Request mode must be a known Generation Mode",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
