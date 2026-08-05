import { z } from "zod";

/** A pointer from a `NodeInstance` to its most recently captured `NodeSnapshot` — never the Snapshot payload itself. */
export const nodeSnapshotReferenceSchema = z.object({
  snapshotId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  capturedAt: z.string().datetime(),
});

export type NodeSnapshotReference = z.infer<typeof nodeSnapshotReferenceSchema>;
