import { z } from "zod";

/**
 * Trace metadata stamped onto a `KnowledgeVersionExecution` by the Pipeline's Tracing
 * stage (stage 4) — traceId/correlationId propagation and a per-run timestamp/counter.
 * "No external telemetry." — pure metadata on the execution record.
 */
export const knowledgeVersionTraceSchema = z.object({
  traceId: z.string().min(1),
  correlationId: z.string().min(1),
  operation: z.string().min(1),
  tracedAt: z.string().datetime(),
  runCount: z.number().int().positive(),
});

export type KnowledgeVersionTrace = z.infer<typeof knowledgeVersionTraceSchema>;
