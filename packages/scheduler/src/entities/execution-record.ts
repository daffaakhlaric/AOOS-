/** One execution attempt's audit trail entry — reported by whatever Runtime actually executes the Job (out of scope here). */
export interface ExecutionRecord {
  readonly executionId: string;
  readonly jobId: string;
  readonly attempt: number;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly outcome?: "completed" | "failed";
  readonly error?: string;
}
