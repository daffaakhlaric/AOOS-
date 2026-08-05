import { z } from "zod";

import { NodeType } from "../contracts/node-type.js";

import { baseNodeSchema } from "./base-node.js";

/** Forks execution into 2+ concurrent branches — paired with a `MergeNode` to rejoin. */
export const parallelNodeSchema = baseNodeSchema.extend({
  type: z.literal(NodeType.PARALLEL),
  branchNodeIds: z.array(z.string().min(1)).min(2),
});

export type ParallelNode = z.infer<typeof parallelNodeSchema>;
