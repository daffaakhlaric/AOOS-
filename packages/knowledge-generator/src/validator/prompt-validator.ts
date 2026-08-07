import type {
  GeneratorValidationIssue,
  GeneratorValidationResult,
  IKnowledgeGeneratorValidator,
  KnowledgeGeneratorValidationInput,
} from "../contracts/i-knowledge-generator-validator.js";

/** Stage 5 — Prompt: a declared `promptReferenceId` must resolve against the Prompt Registry bucket. */
export class PromptValidator implements IKnowledgeGeneratorValidator {
  readonly name = "prompt";

  validate(input: KnowledgeGeneratorValidationInput): GeneratorValidationResult {
    const issues: GeneratorValidationIssue[] = [];
    if (input.request.promptReferenceId && input.promptResolvable === false) {
      issues.push({
        path: "request.promptReferenceId",
        message: `Prompt Reference "${input.request.promptReferenceId}" does not resolve`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
