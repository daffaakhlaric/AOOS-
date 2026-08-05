import type {
  IKnowledgeValidatorStage,
  KnowledgeValidationInput,
  KnowledgeValidationResult,
} from "./i-knowledge-validator.js";

/** "Language" — when `allowedLanguages` is configured, the Asset's `metadata.language` (if set) must be one of them. */
export class LanguageValidator implements IKnowledgeValidatorStage {
  readonly name = "language";

  validate(input: KnowledgeValidationInput): KnowledgeValidationResult {
    const issues: KnowledgeValidationResult["issues"][number][] = [];
    const language = input.asset?.metadata.language;
    if (input.allowedLanguages && language && !input.allowedLanguages.includes(language)) {
      issues.push({
        path: "metadata.language",
        message: `Language "${language}" is not in the allowed Language list`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
