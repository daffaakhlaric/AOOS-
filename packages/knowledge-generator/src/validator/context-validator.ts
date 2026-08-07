import type {
  GeneratorValidationIssue,
  GeneratorValidationResult,
  IKnowledgeGeneratorValidator,
  KnowledgeGeneratorValidationInput,
} from "../contracts/i-knowledge-generator-validator.js";

/** Stage 4 — Context: a declared `contextReferenceId` must resolve against the Context Registry bucket. */
export class ContextValidator implements IKnowledgeGeneratorValidator {
  readonly name = "context";

  validate(input: KnowledgeGeneratorValidationInput): GeneratorValidationResult {
    const issues: GeneratorValidationIssue[] = [];
    if (input.request.contextReferenceId && input.contextResolvable === false) {
      issues.push({
        path: "request.contextReferenceId",
        message: `Context Reference "${input.request.contextReferenceId}" does not resolve`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
