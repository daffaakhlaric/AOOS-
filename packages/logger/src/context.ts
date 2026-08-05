import { AsyncLocalStorage } from "node:async_hooks";

export interface LogContext {
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly traceId?: string;
  readonly tenantId?: string;
}

const storage = new AsyncLocalStorage<LogContext>();

/** Runs `fn` with the given LogContext available to any `getLogContext()` call within it. */
export function withLogContext<T>(context: LogContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** Returns the current LogContext, or an empty object if called outside `withLogContext`. */
export function getLogContext(): LogContext {
  return storage.getStore() ?? {};
}
