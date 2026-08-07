import { describe, expect, it } from "vitest";

import { ConfigurationService } from "../../src/configuration/configuration-service.js";
import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";

describe("ConfigurationService — further coverage", () => {
  const service = new ConfigurationService();

  it("an empty cycleCheckedEdgeTypes set is honored verbatim (cycle checks fully disabled)", () => {
    const resolved = service.resolve({ cycleCheckedEdgeTypes: new Set() });
    expect(resolved.cycleCheckedEdgeTypes.size).toBe(0);
  });

  it("partial overrides fall back to defaults for the untouched fields", () => {
    const resolved = service.resolve({ strictRelationshipValidation: false });
    expect(resolved.strictRelationshipValidation).toBe(false);
    expect(resolved.cycleCheckedEdgeTypes.has(KnowledgeEdgeType.DependsOn)).toBe(true);
  });

  it("resolve() called twice with no args returns independently equal (but not identical) results", () => {
    const first = service.resolve();
    const second = service.resolve();
    expect(first).not.toBe(second);
    expect(first.strictRelationshipValidation).toBe(second.strictRelationshipValidation);
  });

  it("a large maxTraversalDepth is accepted", () => {
    const resolved = service.resolve({ maxTraversalDepth: 1000 });
    expect(resolved.maxTraversalDepth).toBe(1000);
  });
});
