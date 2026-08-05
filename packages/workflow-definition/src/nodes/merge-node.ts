import { z } from "zod";

import { NodeType } from "../contracts/node-type.js";

import { baseNodeSchema } from "./base-node.js";

/** Rejoins the branches a `ParallelNode` forked — `waitForAll: false` models a "first one wins" join. */
export const mergeNodeSchema = baseNodeSchema.extend({
  type: z.literal(NodeType.MERGE),
  joinNodeIds: z.array(z.string().min(1)).min(2),
  waitForAll: z.boolean().default(true),
});

export type MergeNode = z.infer<typeof mergeNodeSchema>;
