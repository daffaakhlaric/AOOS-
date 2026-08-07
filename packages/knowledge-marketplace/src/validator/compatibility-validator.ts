import type {
  IKnowledgeMarketplaceValidator,
  KnowledgeMarketplaceValidationInput,
  MarketplaceValidationIssue,
  MarketplaceValidationResult,
} from "../contracts/i-knowledge-marketplace-validator.js";

/** Stage 6 — Compatibility: when declared, `aosVersion`/`requiredKnowledgeVersion` must be non-empty. Metadata comparison only. */
export class CompatibilityValidator implements IKnowledgeMarketplaceValidator {
  readonly name = "compatibility";

  validate(input: KnowledgeMarketplaceValidationInput): MarketplaceValidationResult {
    const issues: MarketplaceValidationIssue[] = [];
    const compatibility = input.compatibility;
    if (compatibility) {
      if (compatibility.aosVersion.trim().length === 0) {
        issues.push({
          path: "compatibility.aosVersion",
          message: "Compatibility aosVersion must not be empty",
        });
      }
      if (compatibility.requiredKnowledgeVersion.trim().length === 0) {
        issues.push({
          path: "compatibility.requiredKnowledgeVersion",
          message: "Compatibility requiredKnowledgeVersion must not be empty",
        });
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
