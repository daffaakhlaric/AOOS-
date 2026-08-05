import { z } from "zod";

import { NodeType } from "../contracts/node-type.js";

import { baseNodeSchema } from "./base-node.js";

/** "Capability Driven" (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md — "DESIGN AOS-WDL") — a unit of work expressed as a Capability id (`@aos/registry`'s Capability namespace), not a concrete Tool call. */
export const capabilityNodeSchema = baseNodeSchema.extend({
  type: z.literal(NodeType.CAPABILITY),
  capability: z.string().min(1),
  capabilityVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .optional(),
});

export type CapabilityNode = z.infer<typeof capabilityNodeSchema>;
