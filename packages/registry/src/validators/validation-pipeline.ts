import type { IValidator, ValidationContext, ValidationResult } from "../interfaces/i-validator.js";

/** Runs every configured validator in order, aggregating all issues (does not short-circuit on first failure). */
export class ValidationPipeline<TManifest> {
  constructor(private readonly validators: readonly IValidator<TManifest>[]) {}

  async run(manifest: TManifest, context: ValidationContext): Promise<ValidationResult> {
    const allIssues: ValidationResult["issues"][number][] = [];
    for (const validator of this.validators) {
      const result = await validator.validate(manifest, context);
      allIssues.push(...result.issues);
    }
    return { valid: allIssues.length === 0, issues: allIssues };
  }
}
