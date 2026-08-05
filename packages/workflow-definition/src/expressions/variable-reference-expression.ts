import { z } from "zod";

import { ExpressionType } from "../contracts/expression-type.js";

/** References a declared Variable by name — resolved (not evaluated) by a future Workflow Runtime. */
export const variableReferenceExpressionSchema = z.object({
  type: z.literal(ExpressionType.VARIABLE_REFERENCE),
  variableName: z.string().min(1),
});

export type VariableReferenceExpression = z.infer<typeof variableReferenceExpressionSchema>;
