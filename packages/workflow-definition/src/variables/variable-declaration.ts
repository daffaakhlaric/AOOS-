import { z } from "zod";

import { VariableScope } from "../contracts/variable-scope.js";

import { VariableType } from "./variable-type.js";

/**
 * A single Variable Declaration (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md —
 * "VARIABLES": Workflow/Node/Global/Temporary/Environment). A Workflow Definition's
 * `variables[]` and each Node's own `variables[]` both use this same shape — Scope is
 * what distinguishes them, not a different schema.
 */
export const variableDeclarationSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "name must be a valid identifier"),
  type: z.nativeEnum(VariableType),
  scope: z.nativeEnum(VariableScope),
  required: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
  description: z.string().min(1).optional(),
});

export type VariableDeclaration = z.infer<typeof variableDeclarationSchema>;
