/** The actor identifier used when an action is attributable to the system itself, not a human or Agent. */
export const SYSTEM_ACTOR_ID = "system" as const;

/** Default request timeout, milliseconds — overridden per-call by @aos/config in real services. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Default retry attempt ceiling for generic retryable operations (see @aos/utils `retry`). */
export const DEFAULT_MAX_RETRY_ATTEMPTS = 3;

/** HTTP header name AOS uses to propagate a request's correlation identifier. */
export const CORRELATION_ID_HEADER = "x-correlation-id" as const;

/** HTTP header name AOS uses to propagate a request's tenant identifier. */
export const TENANT_ID_HEADER = "x-tenant-id" as const;

/** HTTP header name AOS uses to propagate a distributed trace identifier. */
export const TRACE_ID_HEADER = "x-trace-id" as const;
