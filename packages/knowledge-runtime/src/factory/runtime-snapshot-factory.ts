import type { KnowledgeRuntimeExecution } from "../domain/knowledge-runtime-execution.js";
import type { KnowledgeRuntimeSnapshot } from "../domain/knowledge-runtime-snapshot.js";
import { generateId } from "../utils/id.js";

/**
 * Produces a fresh, unrecorded `KnowledgeRuntimeSnapshot` — distinct from
 * `SnapshotManager#capture()`, which also appends it into that class's own ordered,
 * per-token history.
 */
export class RuntimeSnapshotFactory {
  create(execution: KnowledgeRuntimeExecution, sequence = 0): KnowledgeRuntimeSnapshot {
    return {
      id: generateId(),
      instanceToken: execution.instance.token,
      sequence,
      capturedAt: new Date().toISOString(),
      instance: execution.instance,
      context: execution.context,
    };
  }
}
