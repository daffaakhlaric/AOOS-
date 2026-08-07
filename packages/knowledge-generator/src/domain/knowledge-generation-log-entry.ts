/** One structured, in-memory log entry appended by the Pipeline's Logging stage (Stage 10). */
export interface KnowledgeGenerationLogEntry {
  readonly sequence: number;
  readonly level: "info" | "warn" | "error";
  readonly operation: string;
  readonly message: string;
  readonly occurredAt: string;
}
