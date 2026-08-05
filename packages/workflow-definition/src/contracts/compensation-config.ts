import { z } from "zod";

/** Compensation Contract — the Saga-style "undo" reference a Workflow or Node declares (definition metadata only, no compensation runs in this package). */
export const compensationConfigSchema = z.object({
  /** Node id (`Node.id`) whose logic reverses this Workflow/Node's effect. */
  compensationNodeId: z.string().min(1),
  description: z.string().min(1).optional(),
});

export type CompensationConfig = z.infer<typeof compensationConfigSchema>;
