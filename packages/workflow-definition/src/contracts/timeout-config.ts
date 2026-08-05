import { z } from "zod";

/** Timeout Contract — a Workflow or Node's declared timeout (definition metadata only, no timer runs in this package). */
export const timeoutConfigSchema = z.object({
  durationMs: z.number().int().positive(),
  /** Transition id (`Transition.id`) to follow when the timeout elapses — resolved by validator/transition-validator.ts, not executed here. */
  onTimeoutTransitionId: z.string().min(1).optional(),
});

export type TimeoutConfig = z.infer<typeof timeoutConfigSchema>;
