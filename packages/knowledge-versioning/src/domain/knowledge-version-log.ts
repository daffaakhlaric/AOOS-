import { z } from "zod";

/**
 * One structured, in-memory log entry appended to a `KnowledgeVersionExecution` by the
 * Pipeline's Logging stage (stage 8). "No external telemetry." — entries live on the
 * execution record only; no console, no logger backend.
 */
export const knowledgeVersionLogEntrySchema = z.object({
  sequence: z.number().int().nonnegative(),
  level: z.enum(["info", "warn", "error"]),
  operation: z.string().min(1),
  message: z.string().min(1),
  occurredAt: z.string().datetime(),
});

export type KnowledgeVersionLogEntry = z.infer<typeof knowledgeVersionLogEntrySchema>;
