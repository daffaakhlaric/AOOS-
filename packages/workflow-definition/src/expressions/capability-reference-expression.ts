import { z } from "zod";

import { ExpressionType } from "../contracts/expression-type.js";

/** References a Capability id (`@aos/registry`'s Capability namespace, e.g. "inventory.read") — resolved (not evaluated) by a future Workflow Runtime. */
export const capabilityReferenceExpressionSchema = z.object({
  type: z.literal(ExpressionType.CAPABILITY_REFERENCE),
  capabilityId: z.string().min(1),
});

export type CapabilityReferenceExpression = z.infer<typeof capabilityReferenceExpressionSchema>;
