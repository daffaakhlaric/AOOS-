import { KnowledgeSearchMode } from "../domain/knowledge-search-mode.js";

import type {
  IKnowledgeRetrievalValidatorStage,
  KnowledgeRetrievalValidationInput,
  KnowledgeRetrievalValidationResult,
} from "./i-knowledge-retrieval-validator.js";

/** Flags an unknown `KnowledgeSearchMode` value and duplicate entries in `query.searchModes`. */
export class SearchModeValidator implements IKnowledgeRetrievalValidatorStage {
  readonly name = "searchMode";

  validate(input: KnowledgeRetrievalValidationInput): KnowledgeRetrievalValidationResult {
    const issues = [];
    const known = new Set(Object.values(KnowledgeSearchMode));
    for (const mode of input.query.searchModes) {
      if (!known.has(mode)) {
        issues.push({ path: "query.searchModes", message: `Unknown Search Mode "${mode}"` });
      }
    }
    if (new Set(input.query.searchModes).size !== input.query.searchModes.length) {
      issues.push({
        path: "query.searchModes",
        message: "searchModes must not contain duplicates",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
