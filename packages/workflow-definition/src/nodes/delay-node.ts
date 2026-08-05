import { z } from "zod";

import { NodeType } from "../contracts/node-type.js";

import { baseNodeSchema } from "./base-node.js";

/** Pauses for a fixed duration — definition metadata only; no timer runs in this package. */
export const delayNodeSchema = baseNodeSchema.extend({
  type: z.literal(NodeType.DELAY),
  durationMs: z.number().int().positive(),
});

export type DelayNode = z.infer<typeof delayNodeSchema>;
