import { z } from "zod";

/** Retry Contract — a Workflow or Node's declared retry policy (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md — "Retry"). Definition metadata only; no retry is ever executed by this package. */
export enum RetryBackoffStrategy {
  EXPONENTIAL = "exponential",
  LINEAR = "linear",
}

export const retryConfigSchema = z.object({
  strategy: z.nativeEnum(RetryBackoffStrategy),
  maxAttempts: z.number().int().positive(),
  baseDelayMs: z.number().int().nonnegative().default(1000),
  maxDelayMs: z.number().int().positive().default(30_000),
});

export type RetryConfig = z.infer<typeof retryConfigSchema>;
