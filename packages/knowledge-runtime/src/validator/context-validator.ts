import type {
  IKnowledgeRuntimeValidatorStage,
  KnowledgeRuntimeValidationInput,
  KnowledgeRuntimeValidationResult,
} from "./i-knowledge-runtime-validator.js";

/** Flags a `KnowledgeRuntimeContext` missing `tenantId`/`correlationId`, or whose `knowledgeId` disagrees with its own Instance's `knowledgeId`. */
export class ContextValidator implements IKnowledgeRuntimeValidatorStage {
  readonly name = "context";

  validate(input: KnowledgeRuntimeValidationInput): KnowledgeRuntimeValidationResult {
    const { instance, context } = input.execution;
    const issues = [];
    if (context.tenantId.trim().length === 0) {
      issues.push({ path: "context.tenantId", message: "Context tenantId must not be empty" });
    }
    if (context.correlationId.trim().length === 0) {
      issues.push({
        path: "context.correlationId",
        message: "Context correlationId must not be empty",
      });
    }
    if (context.knowledgeId !== instance.knowledgeId) {
      issues.push({
        path: "context.knowledgeId",
        message: `Context knowledgeId "${context.knowledgeId}" does not match Instance knowledgeId "${instance.knowledgeId}"`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
