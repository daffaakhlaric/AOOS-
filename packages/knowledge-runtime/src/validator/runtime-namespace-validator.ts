import { isValidKnowledgeNamespace } from "@aos/knowledge-engine";

import type {
  IKnowledgeRuntimeValidatorStage,
  KnowledgeRuntimeValidationInput,
  KnowledgeRuntimeValidationResult,
} from "./i-knowledge-runtime-validator.js";

/** Flags an `instance.assetNamespace` that is present but not a valid `knowledge://` URI. */
export class RuntimeNamespaceValidator implements IKnowledgeRuntimeValidatorStage {
  readonly name = "namespace";

  validate(input: KnowledgeRuntimeValidationInput): KnowledgeRuntimeValidationResult {
    const { assetNamespace } = input.execution.instance;
    if (assetNamespace !== undefined && !isValidKnowledgeNamespace(assetNamespace)) {
      return {
        valid: false,
        issues: [
          {
            path: "instance.assetNamespace",
            message: `"${assetNamespace}" is not a valid knowledge:// namespace`,
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
