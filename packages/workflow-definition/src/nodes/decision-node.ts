import { z } from "zod";

import { NodeType } from "../contracts/node-type.js";
import { expressionSchema } from "../expressions/expression.js";

import { baseNodeSchema } from "./base-node.js";

/** A multi-branch guard (a decision table) — evaluated top-to-bottom, `defaultTransitionId` used when no branch matches. */
export const decisionNodeSchema = baseNodeSchema.extend({
  type: z.literal(NodeType.DECISION),
  branches: z
    .array(z.object({ condition: expressionSchema, transitionId: z.string().min(1) }))
    .min(1),
  defaultTransitionId: z.string().min(1).optional(),
});

export type DecisionNode = z.infer<typeof decisionNodeSchema>;
