/**
 * "GENERATION MODES: Support Create, Rewrite, Expand, Summarize, Improve, Translate,
 * Convert, Explain, Refactor, Merge, Split, Custom." (docs/PROMPT-005.7K-KNOWLEDGE-
 * GENERATOR.md) — the exact 12 Generation Modes, attached to a
 * `KnowledgeGenerationRequest` as a metadata label only.
 */
export enum KnowledgeGenerationMode {
  CREATE = "create",
  REWRITE = "rewrite",
  EXPAND = "expand",
  SUMMARIZE = "summarize",
  IMPROVE = "improve",
  TRANSLATE = "translate",
  CONVERT = "convert",
  EXPLAIN = "explain",
  REFACTOR = "refactor",
  MERGE = "merge",
  SPLIT = "split",
  CUSTOM = "custom",
}
