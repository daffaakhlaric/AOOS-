import type { BaseManifest } from "../contracts/base-manifest.js";
import type { IValidator, ValidationContext, ValidationResult } from "../interfaces/i-validator.js";

/**
 * Per-manifest missing-dependency check: every id in `manifest.dependencies` must be known
 * (already registered, or present in the same load batch — see registry/registry.ts's
 * `load()`, which populates `context.existingIds` with the full batch before validating).
 * The full graph / circular-dependency check runs separately (dependency/dependency-graph.ts).
 */
export class DependencyValidator<TManifest extends BaseManifest> implements IValidator<TManifest> {
  readonly name = "dependency";

  validate(manifest: TManifest, context: ValidationContext): ValidationResult {
    const missing = (manifest.dependencies ?? []).filter((id) => !context.existingIds.has(id));
    return {
      valid: missing.length === 0,
      issues: missing.map((id) => ({
        path: "dependencies",
        message: `Unknown dependency "${id}" — not registered in this Registry`,
      })),
    };
  }
}
