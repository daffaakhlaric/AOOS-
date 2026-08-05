import type { IValidator, ValidationContext, ValidationResult } from "../interfaces/i-validator.js";

export type BusinessRule<TManifest> = (
  manifest: TManifest,
  context: ValidationContext,
) => readonly { readonly path: string; readonly message: string }[];

/**
 * Runs kind-specific business rules (e.g. "category must be one of the known values for this
 * Registry kind") supplied by the concrete Registry kind factory (registry/kinds/*.ts).
 * Defaults to a no-op rule set when a kind declares none.
 */
export class BusinessValidator<TManifest> implements IValidator<TManifest> {
  readonly name = "business";

  constructor(private readonly rules: readonly BusinessRule<TManifest>[] = []) {}

  validate(manifest: TManifest, context: ValidationContext): ValidationResult {
    const issues = this.rules.flatMap((rule) => rule(manifest, context));
    return { valid: issues.length === 0, issues };
  }
}
