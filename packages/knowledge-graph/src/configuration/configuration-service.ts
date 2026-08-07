import type {
  GraphConfiguration,
  ResolvedGraphConfiguration,
} from "../domain/graph-configuration.js";
import { HIERARCHICAL_EDGE_TYPES } from "../edges/edge-type-semantics.js";
import { GraphConfigurationException } from "../errors/graph-configuration-exception.js";
import { PermissiveAuthorizationChecker } from "../infrastructure/permissive-authorization-checker.js";

const DEFAULT_AUTHORIZATION_CHECKER = new PermissiveAuthorizationChecker();

/**
 * Applies documented defaults to a caller-supplied `GraphConfiguration`, producing a fully
 * resolved `ResolvedGraphConfiguration` the pipeline can use without further `undefined` checks.
 */
export class ConfigurationService {
  resolve(configuration: GraphConfiguration = {}): ResolvedGraphConfiguration {
    if (
      configuration.maxTraversalDepth !== undefined &&
      (!Number.isFinite(configuration.maxTraversalDepth) || configuration.maxTraversalDepth < 0)
    ) {
      throw new GraphConfigurationException("maxTraversalDepth must be a finite number >= 0", {
        maxTraversalDepth: configuration.maxTraversalDepth,
      });
    }
    return {
      authorizationChecker: configuration.authorizationChecker ?? DEFAULT_AUTHORIZATION_CHECKER,
      cycleCheckedEdgeTypes: configuration.cycleCheckedEdgeTypes ?? HIERARCHICAL_EDGE_TYPES,
      strictRelationshipValidation: configuration.strictRelationshipValidation ?? true,
      maxTraversalDepth: configuration.maxTraversalDepth,
    };
  }
}
