/**
 * "IKnowledgeQualityStorage" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Extension
 * Points") — interface ONLY. The seam through which a caller-supplied storage adapter
 * persists/retrieves a `KnowledgeQualityReport`'s rendered artifact location. This
 * package never renders or writes the underlying report content itself.
 */
export interface IKnowledgeQualityStorage {
  store(reportId: string, location: string): Promise<void>;
  retrieve(reportId: string): Promise<string | undefined>;
}
