import { z } from "zod";

import { NodeType } from "../contracts/node-type.js";

import { baseNodeSchema } from "./base-node.js";

/** The single entry point of a Workflow — Validation requires exactly one per Workflow Definition. */
export const startNodeSchema = baseNodeSchema.extend({
  type: z.literal(NodeType.START),
});

export type StartNode = z.infer<typeof startNodeSchema>;
