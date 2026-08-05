import type { CancellationToken } from "./cancellation-token.js";
import type { RequestContext } from "./request-context.js";
import type { TenantContext } from "./tenant-context.js";
import type { TraceContext } from "./trace-context.js";
import type { UserContext } from "./user-context.js";

/**
 * The full per-operation context bundle propagated through a single unit of execution —
 * everything downstream code needs to know "who/what/why/how-to-cancel" without threading
 * it through every function signature by hand.
 */
export interface ExecutionContext {
  readonly tenant?: TenantContext;
  readonly user?: UserContext;
  readonly request: RequestContext;
  readonly trace: TraceContext;
  readonly cancellationToken: CancellationToken;
}
