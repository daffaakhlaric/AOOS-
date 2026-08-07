import type {
  IKnowledgeMarketplaceValidator,
  KnowledgeMarketplaceValidationInput,
  MarketplaceValidationIssue,
  MarketplaceValidationResult,
} from "../contracts/i-knowledge-marketplace-validator.js";

const SEMVER_LIKE_PATTERN = /^\d+\.\d+\.\d+/;

/** Stage 7 — Version: the Package's `currentVersion` must be a well-formed, non-empty semver-like string. */
export class VersionValidator implements IKnowledgeMarketplaceValidator {
  readonly name = "version";

  validate(input: KnowledgeMarketplaceValidationInput): MarketplaceValidationResult {
    const issues: MarketplaceValidationIssue[] = [];
    const version = input.package.currentVersion;
    if (version.trim().length === 0) {
      issues.push({
        path: "package.currentVersion",
        message: "Package currentVersion must not be empty",
      });
    } else if (!SEMVER_LIKE_PATTERN.test(version)) {
      issues.push({
        path: "package.currentVersion",
        message: `Package currentVersion "${version}" must look like a semantic version (e.g. "1.0.0")`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
