import type { ResolvedGraphConfiguration } from "../../src/domain/graph-configuration.js";
import { HIERARCHICAL_EDGE_TYPES } from "../../src/edges/edge-type-semantics.js";
import { PermissiveAuthorizationChecker } from "../../src/infrastructure/permissive-authorization-checker.js";

export function buildResolvedConfiguration(
  overrides: Partial<ResolvedGraphConfiguration> = {},
): ResolvedGraphConfiguration {
  return {
    authorizationChecker: new PermissiveAuthorizationChecker(),
    cycleCheckedEdgeTypes: HIERARCHICAL_EDGE_TYPES,
    strictRelationshipValidation: true,
    ...overrides,
  };
}
