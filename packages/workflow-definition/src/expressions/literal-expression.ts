import { z } from "zod";

import { ExpressionType } from "../contracts/expression-type.js";

/** A constant value — the leaf of every Expression tree. */
export const literalExpressionSchema = z.object({
  type: z.literal(ExpressionType.LITERAL),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

export type LiteralExpression = z.infer<typeof literalExpressionSchema>;
