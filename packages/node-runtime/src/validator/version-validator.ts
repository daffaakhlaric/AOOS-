import semver from "semver";

import type { NodeExecution } from "../instance/node-execution.js";

import type { INodeValidator, NodeValidationResult } from "./i-node-validator.js";

/** Confirms the resolved Manifest's `version` is a valid SemVer string. */
export class VersionValidator implements INodeValidator {
  readonly name = "version";

  validate(execution: NodeExecution): NodeValidationResult {
    if (!semver.valid(execution.manifest.version)) {
      return {
        valid: false,
        issues: [
          {
            path: "manifest.version",
            message: `"${execution.manifest.version}" is not a valid SemVer string`,
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
