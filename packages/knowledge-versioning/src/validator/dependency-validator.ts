import type {
  IKnowledgeVersionValidator,
  KnowledgeVersionValidationInput,
  KnowledgeVersionValidationIssue,
  KnowledgeVersionValidationResult,
} from "../contracts/i-knowledge-version-validator.js";

/**
 * Stage 9 — Dependency: a version must never depend on itself, and when the caller
 * supplies the set of known version ids, every declared dependency must reference one —
 * a pure metadata check, no dependency graph is ever dereferenced into content.
 */
export class DependencyValidator implements IKnowledgeVersionValidator {
  readonly name = "dependency";

  validate(input: KnowledgeVersionValidationInput): KnowledgeVersionValidationResult {
    const issues: KnowledgeVersionValidationIssue[] = [];
    if (input.metadata.dependencies.includes(input.metadata.versionId)) {
      issues.push({
        path: "metadata.dependencies",
        message: `Version "${input.metadata.versionId}" must not depend on itself`,
      });
    }
    if (input.knownVersionIds !== undefined) {
      const known = new Set(input.knownVersionIds);
      for (const dependency of input.metadata.dependencies) {
        if (dependency !== input.metadata.versionId && !known.has(dependency)) {
          issues.push({
            path: "metadata.dependencies",
            message: `Version dependency "${dependency}" references no known Version`,
          });
        }
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
