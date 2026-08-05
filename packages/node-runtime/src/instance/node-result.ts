import { z } from "zod";

/**
 * The shape a future Execution Engine (005.6D) will populate once a Node actually runs —
 * this package never sets `output`/`error` itself (no execution happens here), it only
 * carries the contract.
 */
export const nodeResultSchema = z.object({
  success: z.boolean(),
  output: z.record(z.string(), z.unknown()).optional(),
  error: z.string().min(1).optional(),
  completedAt: z.string().datetime().optional(),
});

export type NodeResult = z.infer<typeof nodeResultSchema>;
