import { z } from "zod";

/** Tracing data stamped by the Pipeline's Tracing stage. */
export const knowledgePolicyTraceSchema = z.object({
  traceId: z.string().min(1),
  correlationId: z.string().min(1),
  operation: z.string().min(1),
  tracedAt: z.string().datetime(),
  runCount: z.number().int().min(1),
});

export type KnowledgePolicyTrace = z.infer<typeof knowledgePolicyTraceSchema>;
