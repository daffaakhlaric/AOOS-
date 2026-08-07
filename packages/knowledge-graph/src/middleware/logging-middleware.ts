import type { GraphOperationDescriptor } from "../pipeline/graph-operation-descriptor.js";
import { now } from "../utils/index.js";

import type { PipelineMiddleware } from "./pipeline-middleware.js";

export interface PipelineLogEntry {
  readonly operation: string;
  readonly actor?: string;
  readonly graphId?: string;
  readonly outcome: "success" | "failure";
  readonly errorMessage?: string;
  readonly loggedAt: number;
}

/**
 * Records one `PipelineLogEntry` per pipeline execution (success or failure) into an in-memory,
 * inspectable log. Useful for tests and for hosts that want operation-level audit trails without
 * this package depending on any external logging package.
 */
export class LoggingMiddleware implements PipelineMiddleware {
  private readonly entries: PipelineLogEntry[] = [];

  around<T>(descriptor: GraphOperationDescriptor<T>, next: () => T): T {
    try {
      const output = next();
      this.entries.push({
        operation: descriptor.operation,
        actor: descriptor.actor,
        graphId: descriptor.graphId,
        outcome: "success",
        loggedAt: now(),
      });
      return output;
    } catch (error) {
      this.entries.push({
        operation: descriptor.operation,
        actor: descriptor.actor,
        graphId: descriptor.graphId,
        outcome: "failure",
        errorMessage: error instanceof Error ? error.message : String(error),
        loggedAt: now(),
      });
      throw error;
    }
  }

  getLog(): readonly PipelineLogEntry[] {
    return this.entries;
  }

  clear(): void {
    this.entries.length = 0;
  }
}
