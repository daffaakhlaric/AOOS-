import { z } from "zod";

import { NodeType } from "../contracts/node-type.js";
import { expressionSchema } from "../expressions/expression.js";

import { baseNodeSchema } from "./base-node.js";

/** Repeats `bodyNodeId` while `loopCondition` holds, up to `maxIterations` — an intentional cycle validator/cycle-detector.ts must distinguish from an unintended graph cycle (see Loop Detection). */
export const loopNodeSchema = baseNodeSchema.extend({
  type: z.literal(NodeType.LOOP),
  loopCondition: expressionSchema,
  bodyNodeId: z.string().min(1),
  maxIterations: z.number().int().positive().optional(),
});

export type LoopNode = z.infer<typeof loopNodeSchema>;
