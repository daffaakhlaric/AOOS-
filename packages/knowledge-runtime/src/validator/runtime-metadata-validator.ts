import type {
  IKnowledgeRuntimeValidatorStage,
  KnowledgeRuntimeValidationInput,
  KnowledgeRuntimeValidationResult,
} from "./i-knowledge-runtime-validator.js";

/** Flags duplicate entries in `instance.metadata.labels`. */
export class RuntimeMetadataValidator implements IKnowledgeRuntimeValidatorStage {
  readonly name = "metadata";

  validate(input: KnowledgeRuntimeValidationInput): KnowledgeRuntimeValidationResult {
    const { labels } = input.execution.instance.metadata;
    const unique = new Set(labels);
    if (unique.size !== labels.length) {
      return {
        valid: false,
        issues: [
          {
            path: "instance.metadata.labels",
            message: "Metadata labels must not contain duplicates",
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
