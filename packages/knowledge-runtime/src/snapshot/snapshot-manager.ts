import type { KnowledgeRuntimeExecution } from "../domain/knowledge-runtime-execution.js";
import type { KnowledgeRuntimeSnapshot } from "../domain/knowledge-runtime-snapshot.js";
import { RuntimeSnapshotException } from "../errors/runtime-snapshot-exception.js";
import { generateId } from "../utils/id.js";

/** In-memory Snapshot store — one ordered list per `KnowledgeRuntimeToken`. No persistence, per the source prompt. */
export class SnapshotManager {
  private readonly snapshotsByToken = new Map<string, KnowledgeRuntimeSnapshot[]>();

  capture(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeSnapshot {
    const token = execution.instance.token;
    const existing = this.snapshotsByToken.get(token) ?? [];
    const snapshot: KnowledgeRuntimeSnapshot = {
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

  list(token: string): readonly KnowledgeRuntimeSnapshot[] {
    return this.snapshotsByToken.get(token) ?? [];
  }

  latest(token: string): KnowledgeRuntimeSnapshot {
    const snapshots = this.snapshotsByToken.get(token);
    if (!snapshots || snapshots.length === 0) {
      throw new RuntimeSnapshotException(`No Snapshot has been captured yet for Token "${token}"`);
    }
    return snapshots[snapshots.length - 1]!;
  }
}
