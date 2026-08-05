import { formatKnowledgeVersion } from "../domain/knowledge-version.js";

import type {
  IKnowledgeValidatorStage,
  KnowledgeValidationInput,
  KnowledgeValidationResult,
} from "./i-knowledge-validator.js";

/** "Version" — the Asset Version's `label` must match `major.minor.patch`. */
export class VersionValidator implements IKnowledgeValidatorStage {
  readonly name = "version";

  validate(input: KnowledgeValidationInput): KnowledgeValidationResult {
    const issues: KnowledgeValidationResult["issues"][number][] = [];
    const version = input.asset?.version;
    if (version) {
      const expected = formatKnowledgeVersion(version.major, version.minor, version.patch);
      if (version.label !== expected) {
        issues.push({
          path: "version.label",
          message: `Version label "${version.label}" does not match "${expected}"`,
        });
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
