import type { GraphOperationType } from "../pipeline/graph-operation-type.js";

/** Context supplied to an `IGraphAuthorizationChecker` for a single pipeline-guarded operation. */
export interface GraphAuthorizationRequest {
  readonly operation: GraphOperationType;
  readonly actor?: string;
  readonly graphId?: string;
}

/**
 * Caller-suppliable authorization hook for the pipeline's Authorization stage. This package never
 * imports `@aos/event-bus` or any AOS identity/permission package — a host application supplies
 * its own checker via `GraphConfiguration.authorizationChecker`. When none is supplied the
 * pipeline uses `PermissiveAuthorizationChecker`, which allows every operation (see
 * `src/configuration/permissive-authorization-checker.ts`).
 */
export interface IGraphAuthorizationChecker {
  isAuthorized(request: GraphAuthorizationRequest): boolean;
}
