import type { ZodTypeAny } from "zod";

import type { IValidator, ValidationResult } from "../interfaces/i-validator.js";

/** Validates a manifest against its Zod schema — structural correctness only. */
export class SchemaValidator<TManifest> implements IValidator<TManifest> {
  readonly name = "schema";

  constructor(private readonly schema: ZodTypeAny) {}

  validate(manifest: TManifest): ValidationResult {
    const result = this.schema.safeParse(manifest);
    if (result.success) {
      return { valid: true, issues: [] };
    }
    return {
      valid: false,
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    };
  }
}
