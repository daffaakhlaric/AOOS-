import type { ResolvedGraphConfiguration } from "../domain/graph-configuration.js";
import { GraphAuthorizationException } from "../errors/graph-authorization-exception.js";

import type { GraphOperationDescriptor } from "./graph-operation-descriptor.js";

/**
 * Stage 2 — Authorization. Delegates to the resolved configuration's `authorizationChecker`
 * (defaults to allow-all via `PermissiveAuthorizationChecker` when the host supplies none).
 */
export function runAuthorizationStage<T>(
  descriptor: GraphOperationDescriptor<T>,
  configuration: ResolvedGraphConfiguration,
): void {
  const authorized = configuration.authorizationChecker.isAuthorized({
    operation: descriptor.operation,
    actor: descriptor.actor,
    graphId: descriptor.graphId,
  });
  if (!authorized) {
    throw new GraphAuthorizationException(descriptor.operation, descriptor.actor);
  }
}
