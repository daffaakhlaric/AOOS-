import { parseKnowledgeNamespace } from "../namespace/knowledge-namespace.js";

import type {
  IKnowledgeValidatorStage,
  KnowledgeValidationInput,
  KnowledgeValidationResult,
} from "./i-knowledge-validator.js";

/** "Namespace" — the Asset's `namespace` must parse as a valid `knowledge://` URI whose `tenant` segment matches `scope.tenantId`. */
export class NamespaceValidator implements IKnowledgeValidatorStage {
  readonly name = "namespace";

  validate(input: KnowledgeValidationInput): KnowledgeValidationResult {
    const issues: KnowledgeValidationResult["issues"][number][] = [];
    const asset = input.asset;
    if (asset) {
      try {
        const parsed = parseKnowledgeNamespace(asset.namespace);
        if (parsed.tenant !== asset.scope.tenantId) {
          issues.push({
            path: "namespace",
            message: `Namespace tenant "${parsed.tenant}" does not match scope.tenantId "${asset.scope.tenantId}"`,
          });
        }
      } catch (error) {
        issues.push({
          path: "namespace",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
