import { z } from "zod";

import { compensationConfigSchema } from "../contracts/compensation-config.js";
import { retryConfigSchema } from "../contracts/retry-config.js";
import { timeoutConfigSchema } from "../contracts/timeout-config.js";
import { variableDeclarationSchema } from "../variables/variable-declaration.js";

/**
 * The Node Contract every Node Type extends (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-
 * LANGUAGE.md — "NODE CONTRACT": ID/Name/Type/Description/Capability/Input/Output/
 * Variables/Retry/Timeout/Compensation/Metadata). `type` itself is added by each concrete
 * node schema as a `z.literal`, not here — this is the shared shape, not a standalone node.
 */
export const baseNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  /** Declared input field names → expected `VariableType`, checked structurally, never executed. */
  input: z.record(z.string(), z.string()).optional(),
  output: z.record(z.string(), z.string()).optional(),
  variables: z.array(variableDeclarationSchema).optional(),
  retry: retryConfigSchema.optional(),
  timeout: timeoutConfigSchema.optional(),
  compensation: compensationConfigSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type BaseNode = z.infer<typeof baseNodeSchema>;
