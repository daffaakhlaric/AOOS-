import type { KnowledgeValidationReport } from "../domain/knowledge-validation-report.js";

/**
 * "IKnowledgeValidationReporter" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md —
 * "Extension Points") — interface ONLY. A future seam for a caller-supplied adapter
 * that renders a `KnowledgeValidationReport` into an external format
 * (PDF/HTML/dashboard/...). This package never renders anything itself —
 * `generateReport()` only builds the metadata/summary record.
 */
export interface IKnowledgeValidationReporter {
  render(report: KnowledgeValidationReport): Promise<string>;
}
