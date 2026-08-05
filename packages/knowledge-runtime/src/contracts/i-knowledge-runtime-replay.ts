import type { KnowledgeRuntimeHistoryEntry } from "../domain/knowledge-runtime-history.js";

/** Interface only — no implementation in this package. A future consumer replays a Runtime Instance's recorded History for audit/debugging. */
export interface IKnowledgeRuntimeReplay {
  replayInstance(
    token: string,
  ): AsyncIterable<KnowledgeRuntimeHistoryEntry> | Promise<readonly KnowledgeRuntimeHistoryEntry[]>;
}
