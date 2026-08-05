import { z } from "zod";

import { NodeType } from "../contracts/node-type.js";

import { baseNodeSchema } from "./base-node.js";

/** A terminal point of a Workflow — Validation requires at least one per Workflow Definition. */
export const endNodeSchema = baseNodeSchema.extend({
  type: z.literal(NodeType.END),
});

export type EndNode = z.infer<typeof endNodeSchema>;
