import { z } from "zod";

/** Tracing data stamped by the Pipeline when a `correlationId` is present. */
export const marketplaceTraceSchema = z.object({
  traceId: z.string().min(1),
  correlationId: z.string().min(1),
  operation: z.string().min(1),
  tracedAt: z.string().datetime(),
  runCount: z.number().int().min(1),
});

export type MarketplaceTrace = z.infer<typeof marketplaceTraceSchema>;
