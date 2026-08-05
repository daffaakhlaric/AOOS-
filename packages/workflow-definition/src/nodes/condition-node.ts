import { z } from "zod";

import { NodeType } from "../contracts/node-type.js";
import { expressionSchema } from "../expressions/expression.js";

import { baseNodeSchema } from "./base-node.js";

/** A single boolean guard picking between two outgoing Transitions (the `condition` Transition Kind vs. any other). */
export const conditionNodeSchema = baseNodeSchema.extend({
  type: z.literal(NodeType.CONDITION),
  condition: expressionSchema,
});

export type ConditionNode = z.infer<typeof conditionNodeSchema>;
