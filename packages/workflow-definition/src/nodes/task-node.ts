import { z } from "zod";

import { NodeType } from "../contracts/node-type.js";

import { baseNodeSchema } from "./base-node.js";

/** A generic unit of work whose implementation is external to AOS-WDL — resolved by a future Workflow Runtime, not this package. */
export const taskNodeSchema = baseNodeSchema.extend({
  type: z.literal(NodeType.TASK),
  taskRef: z.string().min(1).optional(),
});

export type TaskNode = z.infer<typeof taskNodeSchema>;
