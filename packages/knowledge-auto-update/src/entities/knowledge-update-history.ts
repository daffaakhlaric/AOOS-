import type { KnowledgeUpdateJobStatus } from "../types/job-status.js";

export interface KnowledgeUpdateHistoryEntry {
  readonly status: KnowledgeUpdateJobStatus;
  readonly at: number;
  readonly reason: string | undefined;
}

export interface KnowledgeUpdateHistoryProps {
  readonly jobId: string;
  readonly entries: readonly KnowledgeUpdateHistoryEntry[];
}

/** Append-only, immutable record of every status transition a job has gone through. */
export class KnowledgeUpdateHistory {
  readonly jobId: string;
  readonly entries: readonly KnowledgeUpdateHistoryEntry[];

  constructor(props: KnowledgeUpdateHistoryProps) {
    this.jobId = props.jobId;
    this.entries = props.entries;
    Object.freeze(this);
    Object.freeze(this.entries);
  }

  static empty(jobId: string): KnowledgeUpdateHistory {
    return new KnowledgeUpdateHistory({ jobId, entries: [] });
  }

  withEntry(entry: KnowledgeUpdateHistoryEntry): KnowledgeUpdateHistory {
    return new KnowledgeUpdateHistory({ jobId: this.jobId, entries: [...this.entries, entry] });
  }

  latest(): KnowledgeUpdateHistoryEntry | undefined {
    return this.entries[this.entries.length - 1];
  }
}
