export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

/** One stage of the validation pipeline (Schema/Business/Dependency/Version/Permission). */
export interface IValidator<TManifest> {
  readonly name: string;
  validate(
    manifest: TManifest,
    context: ValidationContext,
  ): ValidationResult | Promise<ValidationResult>;
}

export interface ValidationContext {
  readonly existingIds: ReadonlySet<string>;
  readonly existingVersionsById: ReadonlyMap<string, readonly string[]>;
}
