import type {
  GraphAuthorizationRequest,
  IGraphAuthorizationChecker,
} from "../contracts/i-graph-authorization-checker.js";

/**
 * Default `IGraphAuthorizationChecker`: allows every operation. Used by `ConfigurationService`
 * when a host does not supply its own checker — this package has no identity/permission model of
 * its own (standalone constraint), so "no checker configured" must mean "do not block", not
 * "silently deny everything".
 */
export class PermissiveAuthorizationChecker implements IGraphAuthorizationChecker {
  isAuthorized(_request: GraphAuthorizationRequest): boolean {
    return true;
  }
}
