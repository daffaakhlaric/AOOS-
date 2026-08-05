import type {
  IKnowledgeRuntimeValidatorStage,
  KnowledgeRuntimeValidationInput,
  KnowledgeRuntimeValidationResult,
} from "./i-knowledge-runtime-validator.js";

/** Flags a `KnowledgeRuntimeInstance.knowledgeId` that is blank — the id `KnowledgeRuntimeResolver` needs to resolve Relationships/Dependencies/References for. */
export class RuntimeRelationshipValidator implements IKnowledgeRuntimeValidatorStage {
  readonly name = "relationships";

  validate(input: KnowledgeRuntimeValidationInput): KnowledgeRuntimeValidationResult {
    if (input.execution.instance.knowledgeId.trim().length === 0) {
      return {
        valid: false,
        issues: [
          { path: "instance.knowledgeId", message: "Instance knowledgeId must not be blank" },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
