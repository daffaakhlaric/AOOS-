import { generateId } from "../utils/id.js";

import type { KnowledgePolicyHistoryEntry } from "./knowledge-policy-execution.js";

/**
 * Append-only, id-keyed history log for one Policy. Analogous to
 * `KnowledgeHistory` in `@aos/knowledge-versioning`.
 */
export class KnowledgePolicyHistory {
  readonly id: string;
  private readonly entries: KnowledgePolicyHistoryEntry[] = [];

  constructor(policyId: string) {
    this.id = policyId;
  }

  record(input: {
    operation: string;
    fromState?: string;
    toState?: string;
    reason?: string;
  }): KnowledgePolicyHistoryEntry {
    const entry: KnowledgePolicyHistoryEntry = {
      id: generateId(),
      sequence: this.entries.length,
      policyId: this.id,
      operation: input.operation,
      fromState: input.fromState,
      toState: input.toState,
      reason: input.reason,
      occurredAt: new Date().toISOString(),
    };
    this.entries.push(entry);
    return entry;
  }

  list(): readonly KnowledgePolicyHistoryEntry[] {
    return this.entries;
  }

  count(): number {
    return this.entries.length;
  }
}
