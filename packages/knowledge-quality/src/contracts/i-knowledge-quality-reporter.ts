import type { KnowledgeQualityReport } from "../domain/knowledge-quality-report.js";

/**
 * "IKnowledgeQualityReporter" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Extension
 * Points") — interface ONLY. A future seam for a caller-supplied adapter that renders a
 * `KnowledgeQualityReport` into an external format (PDF/HTML/dashboard/...). This
 * package never renders anything itself — `generateReport()` only builds the
 * metadata/summary record.
 */
export interface IKnowledgeQualityReporter {
  render(report: KnowledgeQualityReport): Promise<string>;
}
