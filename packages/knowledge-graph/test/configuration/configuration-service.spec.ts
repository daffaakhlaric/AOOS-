import { describe, expect, it } from "vitest";

import { ConfigurationService } from "../../src/configuration/configuration-service.js";
import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import { HIERARCHICAL_EDGE_TYPES } from "../../src/edges/edge-type-semantics.js";
import { GraphConfigurationException } from "../../src/errors/graph-configuration-exception.js";
import { PermissiveAuthorizationChecker } from "../../src/infrastructure/permissive-authorization-checker.js";

describe("ConfigurationService", () => {
  const service = new ConfigurationService();

  it("resolves documented defaults when given no configuration", () => {
    const resolved = service.resolve();
    expect(resolved.authorizationChecker).toBeInstanceOf(PermissiveAuthorizationChecker);
    expect(resolved.cycleCheckedEdgeTypes).toBe(HIERARCHICAL_EDGE_TYPES);
    expect(resolved.strictRelationshipValidation).toBe(true);
    expect(resolved.maxTraversalDepth).toBeUndefined();
  });

  it("honors caller-supplied overrides", () => {
    const checker = { isAuthorized: () => false };
    const resolved = service.resolve({
      authorizationChecker: checker,
      cycleCheckedEdgeTypes: new Set([KnowledgeEdgeType.Owns]),
      strictRelationshipValidation: false,
      maxTraversalDepth: 5,
    });
    expect(resolved.authorizationChecker).toBe(checker);
    expect(resolved.cycleCheckedEdgeTypes).toEqual(new Set([KnowledgeEdgeType.Owns]));
    expect(resolved.strictRelationshipValidation).toBe(false);
    expect(resolved.maxTraversalDepth).toBe(5);
  });

  it("rejects a negative maxTraversalDepth", () => {
    expect(() => service.resolve({ maxTraversalDepth: -1 })).toThrow(GraphConfigurationException);
  });

  it("rejects a non-finite maxTraversalDepth", () => {
    expect(() => service.resolve({ maxTraversalDepth: Number.NaN })).toThrow(
      GraphConfigurationException,
    );
  });

  it("accepts maxTraversalDepth of exactly 0", () => {
    const resolved = service.resolve({ maxTraversalDepth: 0 });
    expect(resolved.maxTraversalDepth).toBe(0);
  });
});
