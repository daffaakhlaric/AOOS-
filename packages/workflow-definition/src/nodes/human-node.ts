import { z } from "zod";

import { NodeType } from "../contracts/node-type.js";

import { baseNodeSchema } from "./base-node.js";

/** A step requiring a human decision/input — `assigneeRole`/`formRef` are definition metadata a future UI/Runtime resolves. */
export const humanNodeSchema = baseNodeSchema.extend({
  type: z.literal(NodeType.HUMAN),
  assigneeRole: z.string().min(1).optional(),
  formRef: z.string().min(1).optional(),
});

export type HumanNode = z.infer<typeof humanNodeSchema>;
