import { z } from "zod";

import { NodeType } from "../contracts/node-type.js";

import { baseNodeSchema } from "./base-node.js";

/** Invokes another Workflow Definition by id/version — composition, not inlining; resolved by a future Workflow Runtime. */
export const subWorkflowNodeSchema = baseNodeSchema.extend({
  type: z.literal(NodeType.SUB_WORKFLOW),
  subWorkflowId: z.string().min(1),
  subWorkflowVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .optional(),
});

export type SubWorkflowNode = z.infer<typeof subWorkflowNodeSchema>;
