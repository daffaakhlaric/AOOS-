import { z } from "zod";

import { executionPointerSchema } from "./execution-pointer.js";
import { instanceStateSchema } from "./instance-state-schema.js";
import { workflowInstanceMetadataSchema } from "./workflow-instance-metadata.js";
import { workflowSnapshotReferenceSchema } from "./workflow-snapshot-reference.js";

/**
 * The persistent envelope for one execution of a Workflow Definition. `id` is the
 * Instance's stable identity; `token` (`ExecutionToken`) is the externally addressable
 * handle every imperative operation (pause/resume/cancel/replay) uses to look it up.
 */
export const workflowInstanceSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  workflowId: z.string().min(1),
  workflowVersion: z.string().min(1),
  tenantId: z.string().optional(),
  status: instanceStateSchema,
  executionPointer: executionPointerSchema,
  metadata: workflowInstanceMetadataSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  snapshotRef: workflowSnapshotReferenceSchema.optional(),
});

export type WorkflowInstance = z.infer<typeof workflowInstanceSchema>;
