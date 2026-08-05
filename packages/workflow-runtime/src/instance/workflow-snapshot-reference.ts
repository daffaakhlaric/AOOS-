import { z } from "zod";

/** A pointer from a `WorkflowInstance` to its most recently captured Snapshot (`snapshot/snapshot-manager.ts`) — never the Snapshot payload itself. */
export const workflowSnapshotReferenceSchema = z.object({
  snapshotId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  capturedAt: z.string().datetime(),
});

export type WorkflowSnapshotReference = z.infer<typeof workflowSnapshotReferenceSchema>;
