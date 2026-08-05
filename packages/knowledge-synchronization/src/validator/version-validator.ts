import { KnowledgeSynchronizationJobType } from "../domain/knowledge-synchronization-job-type.js";

import type {
  IKnowledgeSynchronizationValidatorStage,
  KnowledgeSynchronizationValidationInput,
  KnowledgeSynchronizationValidationResult,
} from "./i-knowledge-synchronization-validator.js";

/** Flags a `VERSION_SYNC` Job whose Context has no `version`. */
export class VersionValidator implements IKnowledgeSynchronizationValidatorStage {
  readonly name = "version";

  validate(
    input: KnowledgeSynchronizationValidationInput,
  ): KnowledgeSynchronizationValidationResult {
    if (input.job.type === KnowledgeSynchronizationJobType.VERSION_SYNC && !input.context.version) {
      return {
        valid: false,
        issues: [
          {
            path: "context.version",
            message: "A VERSION_SYNC Job requires a Context version",
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
