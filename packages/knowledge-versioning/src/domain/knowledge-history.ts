import { z } from "zod";

import { generateId } from "../utils/id.js";

import { knowledgeVersionStateSchema } from "./knowledge-version-state-schema.js";

/** One recorded history entry — either a state transition or a version operation. */
export const knowledgeHistoryEntrySchema = z.object({
  id: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  versionId: z.string().min(1),
  operation: z.string().min(1),
  fromState: knowledgeVersionStateSchema.optional(),
  toState: knowledgeVersionStateSchema.optional(),
  reason: z.string().optional(),
  occurredAt: z.string().datetime(),
});

export type KnowledgeHistoryEntry = z.infer<typeof knowledgeHistoryEntrySchema>;

export interface RecordKnowledgeHistoryInput {
  readonly operation: string;
  readonly fromState?: KnowledgeHistoryEntry["fromState"];
  readonly toState?: KnowledgeHistoryEntry["toState"];
  readonly reason?: string;
}

/**
 * "KnowledgeHistory" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Domain Model") — the
 * append-only revision-history aggregate for one version. `id` mirrors `versionId` so
 * the aggregate satisfies the Registry's `Identified` constraint and lives in the
 * `HISTORY` bucket. Entries are immutable once recorded — `entries()` returns a
 * defensive copy and there is no removal API.
 */
export class KnowledgeHistory {
  readonly id: string;
  private readonly recorded: KnowledgeHistoryEntry[] = [];

  constructor(readonly versionId: string) {
    this.id = versionId;
  }

  record(input: RecordKnowledgeHistoryInput): KnowledgeHistoryEntry {
    const entry: KnowledgeHistoryEntry = {
      id: generateId(),
      sequence: this.recorded.length,
      versionId: this.versionId,
      operation: input.operation,
      fromState: input.fromState,
      toState: input.toState,
      reason: input.reason,
      occurredAt: new Date().toISOString(),
    };
    this.recorded.push(entry);
    return entry;
  }

  entries(): readonly KnowledgeHistoryEntry[] {
    return [...this.recorded];
  }

  count(): number {
    return this.recorded.length;
  }

  latest(): KnowledgeHistoryEntry | undefined {
    return this.recorded[this.recorded.length - 1];
  }
}
