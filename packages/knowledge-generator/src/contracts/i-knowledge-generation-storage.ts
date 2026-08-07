/**
 * "IKnowledgeGenerationStorage" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Extension
 * Points") — interface ONLY. The seam through which a caller-supplied storage adapter
 * persists/retrieves the content location a `KnowledgeGenerationResult` points at. This
 * package never reads or writes the underlying content itself.
 */
export interface IKnowledgeGenerationStorage {
  store(resultId: string, contentLocation: string): Promise<void>;
  retrieve(resultId: string): Promise<string | undefined>;
}
