import { z } from "zod";

import { NodeType } from "../contracts/node-type.js";
import { expressionSchema } from "../expressions/expression.js";

import { baseNodeSchema } from "./base-node.js";

/** Pauses until `waitCondition` holds (definition metadata only) — the structural hook a future Event Node/trigger would satisfy. */
export const waitNodeSchema = baseNodeSchema.extend({
  type: z.literal(NodeType.WAIT),
  waitCondition: expressionSchema.optional(),
});

export type WaitNode = z.infer<typeof waitNodeSchema>;
