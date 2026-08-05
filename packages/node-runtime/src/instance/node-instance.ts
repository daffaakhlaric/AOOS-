import { z } from "zod";

import { NodeState } from "../contracts/node-state.js";
import { NodeType } from "../contracts/node-type.js";

import { nodeMetadataSchema } from "./node-metadata.js";
import { nodeResultSchema } from "./node-result.js";
import { nodeSnapshotReferenceSchema } from "./node-snapshot-reference.js";

const nodeTypeSchema = z.nativeEnum(NodeType);
const nodeStateSchema = z.nativeEnum(NodeState);

/** The persistent envelope for one Node's participation in a Workflow Instance. `id` is this Node Instance's own identity; `nodeId` is the id of the Node within the Workflow Definition graph. */
export const nodeInstanceSchema = z.object({
  id: z.string().min(1),
  workflowInstanceId: z.string().min(1),
  nodeId: z.string().min(1),
  type: nodeTypeSchema,
  status: nodeStateSchema,
  config: z.record(z.string(), z.unknown()),
  dependsOn: z.array(z.string().min(1)).optional(),
  metadata: nodeMetadataSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  result: nodeResultSchema.optional(),
  snapshotRef: nodeSnapshotReferenceSchema.optional(),
});

export type NodeInstance = z.infer<typeof nodeInstanceSchema>;
