import type { LogContext } from "@aos/logger";

import { SAMPLE_TENANT_ID, SAMPLE_TRACE_ID } from "./fixtures.js";

/** Builds a plausible LogContext for tests, with sensible defaults overridable per-field. */
export function buildTestLogContext(overrides: Partial<LogContext> = {}): LogContext {
  return {
    tenantId: SAMPLE_TENANT_ID,
    traceId: SAMPLE_TRACE_ID,
    ...overrides,
  };
}
