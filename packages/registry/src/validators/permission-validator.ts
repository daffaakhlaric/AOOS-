import type { BaseManifest } from "../contracts/base-manifest.js";
import type { IValidator, ValidationResult } from "../interfaces/i-validator.js";

const PERMISSION_PATTERN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

/**
 * Structurally validates the `permissions` field every manifest may declare (e.g. the
 * user-revised Agent manifest's `permissions: [social.publish]`) — each entry must be a
 * `resource.action` string. This does NOT check the permission is granted (that is the future
 * Permission Registry's + Guardrail Engine's job, out of scope here per Constitution §25).
 */
export class PermissionValidator<TManifest extends BaseManifest> implements IValidator<TManifest> {
  readonly name = "permission";

  validate(manifest: TManifest): ValidationResult {
    const permissions = manifest.permissions ?? [];
    const malformed = permissions.filter((permission) => !PERMISSION_PATTERN.test(permission));
    return {
      valid: malformed.length === 0,
      issues: malformed.map((permission) => ({
        path: "permissions",
        message: `"${permission}" does not match the required "resource.action" format`,
      })),
    };
  }
}
