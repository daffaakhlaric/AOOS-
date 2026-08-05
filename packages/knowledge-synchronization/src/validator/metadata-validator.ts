import type {
  IKnowledgeSynchronizationValidatorStage,
  KnowledgeSynchronizationValidationInput,
  KnowledgeSynchronizationValidationResult,
} from "./i-knowledge-synchronization-validator.js";

const RESERVED_METADATA_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Flags reserved/unsafe keys in `context.metadata`. */
export class MetadataValidator implements IKnowledgeSynchronizationValidatorStage {
  readonly name = "metadata";

  validate(
    input: KnowledgeSynchronizationValidationInput,
  ): KnowledgeSynchronizationValidationResult {
    const issues = Object.keys(input.context.metadata)
      .filter((key) => RESERVED_METADATA_KEYS.has(key))
      .map((key) => ({
        path: `context.metadata.${key}`,
        message: `Metadata key "${key}" is reserved and must not be used`,
      }));
    return { valid: issues.length === 0, issues };
  }
}
