import { SnapshotException } from "../errors/snapshot-exception.js";
import type { ExecutionToken } from "../instance/execution-token.js";
import type { WorkflowExecution } from "../instance/workflow-execution.js";
import { generateId } from "../utils/id.js";

import type { WorkflowSnapshot } from "./i-snapshot.js";

/** In-memory Snapshot store — one ordered list per `ExecutionToken`. No persistence, per the source prompt. */
export class SnapshotManager {
  private readonly snapshotsByToken = new Map<ExecutionToken, WorkflowSnapshot[]>();

  capture(execution: WorkflowExecution): WorkflowSnapshot {
    const token = execution.instance.token;
    const existing = this.snapshotsByToken.get(token) ?? [];
    const snapshot: WorkflowSnapshot = {
      id: generateId(),
      instanceToken: token,
      sequence: existing.length,
      capturedAt: new Date().toISOString(),
      instance: execution.instance,
      context: execution.context,
    };
    this.snapshotsByToken.set(token, [...existing, snapshot]);
    return snapshot;
  }

  list(token: ExecutionToken): readonly WorkflowSnapshot[] {
    return this.snapshotsByToken.get(token) ?? [];
  }

  latest(token: ExecutionToken): WorkflowSnapshot {
    const snapshots = this.snapshotsByToken.get(token);
    if (!snapshots || snapshots.length === 0) {
      throw new SnapshotException(
        `No Snapshot has been captured yet for ExecutionToken "${token}"`,
      );
    }
    return snapshots[snapshots.length - 1]!;
  }
}
