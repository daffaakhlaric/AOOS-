import { z } from "zod";

import { RetryStrategy } from "./retry-policy.js";

/** The serializable, storable shape of a Retry Policy — `retry/retry-policy-factory.ts` turns this into a live `IRetryPolicy`. */
export const retryPolicyConfigSchema = z.object({
  strategy: z.nativeEnum(RetryStrategy),
  maxAttempts: z.number().int().positive(),
  baseDelayMs: z.number().int().nonnegative().default(1000),
  maxDelayMs: z.number().int().positive().default(30_000),
});

export type RetryPolicyConfig = z.infer<typeof retryPolicyConfigSchema>;
