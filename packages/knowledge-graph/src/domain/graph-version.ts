/** Links a `KnowledgeGraph`'s monotonic version counter to the `GraphSnapshot` taken at that version. */
export interface GraphVersion {
  readonly graphId: string;
  readonly version: number;
  readonly snapshotId: string;
  readonly createdAt: number;
}
