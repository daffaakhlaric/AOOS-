import { describe, expect, it } from "vitest";

import { KnowledgeIntelligenceConfigurationFactory } from "../../src/factories/knowledge-intelligence-configuration-factory.js";

describe("KnowledgeIntelligenceConfigurationFactory", () => {
  it("creates a default configuration when no overrides are given", () => {
    const config = new KnowledgeIntelligenceConfigurationFactory().create();
    expect(config.readinessMinScore).toBe(70);
  });

  it("applies overrides on top of the defaults", () => {
    const config = new KnowledgeIntelligenceConfigurationFactory().create({
      readinessMinScore: 40,
    });
    expect(config.readinessMinScore).toBe(40);
  });
});
