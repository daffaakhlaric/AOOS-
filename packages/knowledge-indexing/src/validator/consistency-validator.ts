import type { KnowledgeIndexEntry } from "../domain/knowledge-index-entry.js";
import { KnowledgeIndexRegistryBucket } from "../registry/knowledge-index-registry-bucket.js";

import type {
  IKnowledgeIndexValidatorStage,
  KnowledgeIndexValidationInput,
  KnowledgeIndexValidationResult,
} from "./i-knowledge-index-validator.js";

/** Flags an already-registered Index Entry for this Asset whose `namespace` disagrees with the Asset's current `namespace` — a sign the Asset moved without a Reindex. */
export class ConsistencyValidator implements IKnowledgeIndexValidatorStage {
  readonly name = "consistency";

  validate(input: KnowledgeIndexValidationInput): KnowledgeIndexValidationResult {
    const existing = input.registry
      .list<KnowledgeIndexEntry>(KnowledgeIndexRegistryBucket.INDEX)
      .filter((entry) => entry.assetId === input.asset.id);

    const inconsistent = existing.filter((entry) => entry.namespace !== input.asset.namespace);
    if (inconsistent.length > 0) {
      return {
        valid: false,
        issues: inconsistent.map((entry) => ({
          path: `index.${entry.id}.namespace`,
          message: `Existing Index Entry "${entry.id}" namespace "${entry.namespace}" disagrees with Asset namespace "${input.asset.namespace}"`,
        })),
      };
    }
    return { valid: true, issues: [] };
  }
}
