import type {
  IKnowledgeVersionValidator,
  KnowledgeVersionValidationInput,
  KnowledgeVersionValidationResult,
} from "../contracts/i-knowledge-version-validator.js";
import { NUMERIC_KNOWLEDGE_VERSION_TYPES } from "../domain/knowledge-version-type.js";

const NUMERIC_VERSION_NUMBER_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * Stage 3 — Version Number: Major/Minor/Patch/Release/Hotfix versions must carry a
 * strict `major.minor.patch` numeric version number; the other five Version Types only
 * need a non-blank version label.
 */
export class VersionNumberValidator implements IKnowledgeVersionValidator {
  readonly name = "versionNumber";

  validate(input: KnowledgeVersionValidationInput): KnowledgeVersionValidationResult {
    const { versionNumber, versionType } = input.metadata;
    if (versionNumber.trim().length === 0) {
      return {
        valid: false,
        issues: [
          { path: "metadata.versionNumber", message: "Version versionNumber must not be empty" },
        ],
      };
    }
    if (
      NUMERIC_KNOWLEDGE_VERSION_TYPES.has(versionType) &&
      !NUMERIC_VERSION_NUMBER_PATTERN.test(versionNumber)
    ) {
      return {
        valid: false,
        issues: [
          {
            path: "metadata.versionNumber",
            message: `Version Type "${versionType}" requires a numeric "major.minor.patch" versionNumber — got "${versionNumber}"`,
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
