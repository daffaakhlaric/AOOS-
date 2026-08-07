import type {
  IKnowledgeMarketplaceValidator,
  KnowledgeMarketplaceValidationInput,
  MarketplaceValidationIssue,
  MarketplaceValidationResult,
} from "../contracts/i-knowledge-marketplace-validator.js";

/** Stage 5 — Dependency: no self-dependency, and (when known) each dependency targets a known Package. Metadata presence check only. */
export class DependencyValidator implements IKnowledgeMarketplaceValidator {
  readonly name = "dependency";

  validate(input: KnowledgeMarketplaceValidationInput): MarketplaceValidationResult {
    const issues: MarketplaceValidationIssue[] = [];
    const dependencies = input.dependencies ?? [];
    for (const dependency of dependencies) {
      if (dependency.dependencyPackageId === input.package.packageId) {
        issues.push({
          path: `dependency.${dependency.id}`,
          message: "A Package must not declare a Dependency on itself",
        });
      }
      if (
        input.knownPackageIds &&
        !input.knownPackageIds.includes(dependency.dependencyPackageId)
      ) {
        issues.push({
          path: `dependency.${dependency.id}`,
          message: `Dependency Package Id "${dependency.dependencyPackageId}" is not a known registered Package`,
        });
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
