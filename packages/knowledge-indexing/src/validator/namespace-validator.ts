import { isValidKnowledgeNamespace } from "@aos/knowledge-engine";

import type {
  IKnowledgeIndexValidatorStage,
  KnowledgeIndexValidationInput,
  KnowledgeIndexValidationResult,
} from "./i-knowledge-index-validator.js";

/** Flags a `KnowledgeAsset.namespace` that is not a valid `knowledge://` URI. */
export class NamespaceValidator implements IKnowledgeIndexValidatorStage {
  readonly name = "namespace";

  validate(input: KnowledgeIndexValidationInput): KnowledgeIndexValidationResult {
    if (!isValidKnowledgeNamespace(input.asset.namespace)) {
      return {
        valid: false,
        issues: [
          {
            path: "asset.namespace",
            message: `"${input.asset.namespace}" is not a valid knowledge:// namespace`,
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
