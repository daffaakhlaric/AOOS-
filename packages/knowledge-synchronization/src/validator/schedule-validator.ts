import { KnowledgeSynchronizationJobType } from "../domain/knowledge-synchronization-job-type.js";
import { KnowledgeSynchronizationMode } from "../domain/knowledge-synchronization-mode.js";

import type {
  IKnowledgeSynchronizationValidatorStage,
  KnowledgeSynchronizationValidationInput,
  KnowledgeSynchronizationValidationResult,
} from "./i-knowledge-synchronization-validator.js";

/** Flags a Job whose `mode` is `SCHEDULED` but whose `type` is not `SCHEDULED_SYNC` — a Scheduled Job must be run via a Schedule entry, not any other Job type. */
export class ScheduleValidator implements IKnowledgeSynchronizationValidatorStage {
  readonly name = "schedule";

  validate(
    input: KnowledgeSynchronizationValidationInput,
  ): KnowledgeSynchronizationValidationResult {
    if (
      input.job.mode === KnowledgeSynchronizationMode.SCHEDULED &&
      input.job.type !== KnowledgeSynchronizationJobType.SCHEDULED_SYNC
    ) {
      return {
        valid: false,
        issues: [
          {
            path: "job.type",
            message: "A Job with mode SCHEDULED must have type SCHEDULED_SYNC",
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
