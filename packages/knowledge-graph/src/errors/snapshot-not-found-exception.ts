import { KnowledgeGraphException } from "./knowledge-graph-exception.js";

/** Thrown when a Snapshot Registry lookup finds no `GraphSnapshot` for the given id. */
export class SnapshotNotFoundException extends KnowledgeGraphException {
  constructor(snapshotId: string) {
    super(`Snapshot not found: ${snapshotId}`, {
      code: "SNAPSHOT_NOT_FOUND",
      context: { snapshotId },
    });
  }
}
