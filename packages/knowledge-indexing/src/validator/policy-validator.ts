import { KnowledgeClassification } from "@aos/knowledge-engine";

import type {
  IKnowledgeIndexValidatorStage,
  KnowledgeIndexValidationInput,
  KnowledgeIndexValidationResult,
} from "./i-knowledge-index-validator.js";

/** Flags an `asset.classification` that is not one of the 6 declared `KnowledgeClassification` values — the Policy Index is keyed by Classification. */
export class PolicyValidator implements IKnowledgeIndexValidatorStage {
  readonly name = "policy";

  validate(input: KnowledgeIndexValidationInput): KnowledgeIndexValidationResult {
    const valid = Object.values(KnowledgeClassification).includes(input.asset.classification);
    return valid
      ? { valid: true, issues: [] }
      : {
          valid: false,
          issues: [
            {
              path: "asset.classification",
              message: `Unknown Classification "${input.asset.classification}"`,
            },
          ],
        };
  }
}
