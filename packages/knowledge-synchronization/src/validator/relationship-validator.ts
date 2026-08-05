import { KnowledgeSynchronizationJobType } from "../domain/knowledge-synchronization-job-type.js";

import type {
  IKnowledgeSynchronizationValidatorStage,
  KnowledgeSynchronizationValidationInput,
  KnowledgeSynchronizationValidationResult,
} from "./i-knowledge-synchronization-validator.js";

/** Flags a `RELATIONSHIP_SYNC` Job with no `collection` — Relationship Synchronization needs a scoped Knowledge Collection to synchronize relationships within. */
export class RelationshipValidator implements IKnowledgeSynchronizationValidatorStage {
  readonly name = "relationship";

  validate(
    input: KnowledgeSynchronizationValidationInput,
  ): KnowledgeSynchronizationValidationResult {
    if (
      input.job.type === KnowledgeSynchronizationJobType.RELATIONSHIP_SYNC &&
      !input.job.collection
    ) {
      return {
        valid: false,
        issues: [
          {
            path: "job.collection",
            message: "A RELATIONSHIP_SYNC Job must declare a collection",
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
