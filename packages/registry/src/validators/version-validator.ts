import semver from "semver";

import type { BaseManifest } from "../contracts/base-manifest.js";
import type { IValidator, ValidationContext, ValidationResult } from "../interfaces/i-validator.js";

/** Rejects registering a version that is not strictly greater than any already-registered version for the same id. */
export class VersionValidator<TManifest extends BaseManifest> implements IValidator<TManifest> {
  readonly name = "version";

  validate(manifest: TManifest, context: ValidationContext): ValidationResult {
    if (!semver.valid(manifest.version)) {
      return {
        valid: false,
        issues: [
          { path: "version", message: `"${manifest.version}" is not a valid SemVer string` },
        ],
      };
    }

    const existingVersions = context.existingVersionsById.get(manifest.id) ?? [];
    const isDowngradeOrDuplicate = existingVersions.some(
      (existing) => semver.compare(manifest.version, existing) <= 0,
    );

    if (isDowngradeOrDuplicate) {
      return {
        valid: false,
        issues: [
          {
            path: "version",
            message: `Version "${manifest.version}" must be strictly greater than every previously registered version of "${manifest.id}"`,
          },
        ],
      };
    }

    return { valid: true, issues: [] };
  }
}
