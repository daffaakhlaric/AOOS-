import semver from "semver";

import type { BaseEventShape } from "../contracts/base-event.js";

import type { IEventValidator, ValidationContext, ValidationResult } from "./i-event-validator.js";

/**
 * Version Validation — `version`/`schemaVersion` are already regex-checked by the Schema
 * Validator; this stage additionally checks `schemaVersion` (the wire shape) against an
 * optional supported range in `context`, so a producer publishing an incompatible schema
 * version is rejected before it reaches any subscriber.
 */
export class VersionValidator implements IEventValidator {
  readonly name = "version";

  validate(event: BaseEventShape, context: ValidationContext): ValidationResult {
    const range = context.supportedSchemaVersionRange;
    if (!range) {
      return { valid: true, issues: [] };
    }
    if (!semver.valid(event.schemaVersion) || !semver.validRange(range)) {
      return {
        valid: false,
        issues: [
          {
            path: "schemaVersion",
            message: `"${event.schemaVersion}" or range "${range}" is not a valid SemVer value`,
          },
        ],
      };
    }
    if (!semver.satisfies(event.schemaVersion, range)) {
      return {
        valid: false,
        issues: [
          {
            path: "schemaVersion",
            message: `schemaVersion "${event.schemaVersion}" does not satisfy supported range "${range}"`,
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
