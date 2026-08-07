/**
 * "IKnowledgeValidationStorage" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md — "Extension
 * Points") — interface ONLY. The seam through which a caller-supplied storage adapter
 * persists/retrieves a `KnowledgeValidationReport`'s rendered artifact location. This
 * package never renders or writes the underlying report content itself.
 */
export interface IKnowledgeValidationStorage {
  store(reportId: string, location: string): Promise<void>;
  retrieve(reportId: string): Promise<string | undefined>;
}
