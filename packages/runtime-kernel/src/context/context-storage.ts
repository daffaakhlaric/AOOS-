import { AsyncLocalStorage } from "node:async_hooks";

import type { ExecutionContext } from "./execution-context.js";

const storage = new AsyncLocalStorage<ExecutionContext>();

/** Runs `fn` with `context` available to any `getExecutionContext()` call within it (including across `await`). */
export function runWithExecutionContext<T>(context: ExecutionContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** Returns the current ExecutionContext, or `undefined` if called outside `runWithExecutionContext`. */
export function getExecutionContext(): ExecutionContext | undefined {
  return storage.getStore();
}

/** Convenience accessor: the current tenant ID, or `undefined` if there is no context or no tenant. */
export function getCurrentTenantId(): string | undefined {
  return storage.getStore()?.tenant?.tenantId;
}

/** Convenience accessor: the current trace ID, or `undefined` if there is no context. */
export function getCurrentTraceId(): string | undefined {
  return storage.getStore()?.trace.traceId;
}
