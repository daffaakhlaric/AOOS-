import type { GraphSnapshot } from "../domain/graph-snapshot.js";
import { SnapshotNotFoundException } from "../errors/snapshot-not-found-exception.js";

import { RegistryBucket } from "./registry-bucket.js";

/** Id-keyed store of every `GraphSnapshot` taken via Snapshot Graph, used by Restore Graph. */
export class SnapshotRegistry {
  private readonly bucket = new RegistryBucket<GraphSnapshot>(
    "snapshot",
    (id) => new SnapshotNotFoundException(id),
  );

  register(snapshot: GraphSnapshot): GraphSnapshot {
    return this.bucket.register(snapshot.id, snapshot);
  }

  get(snapshotId: string): GraphSnapshot {
    return this.bucket.get(snapshotId);
  }

  tryGet(snapshotId: string): GraphSnapshot | undefined {
    return this.bucket.tryGet(snapshotId);
  }

  has(snapshotId: string): boolean {
    return this.bucket.has(snapshotId);
  }

  remove(snapshotId: string): boolean {
    return this.bucket.remove(snapshotId);
  }

  list(): GraphSnapshot[] {
    return this.bucket.list();
  }

  /** All snapshots registered for a given graph, newest first. */
  listForGraph(graphId: string): GraphSnapshot[] {
    return this.bucket
      .list()
      .filter((snapshot) => snapshot.graphId === graphId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  get size(): number {
    return this.bucket.size;
  }

  clear(): void {
    this.bucket.clear();
  }
}
