import { describe, expect, it } from "vitest";

import { InvalidWeightConfigurationException } from "../../src/errors/invalid-weight-configuration-exception.js";
import { KnowledgeIntelligenceException } from "../../src/errors/knowledge-intelligence-exception.js";

describe("InvalidWeightConfigurationException", () => {
  it("carries the reason and a stable code", () => {
    const error = new InvalidWeightConfigurationException("weights must sum to > 0");
    expect(error.code).toBe("INVALID_WEIGHT_CONFIGURATION");
    expect(error.context).toEqual({ reason: "weights must sum to > 0" });
  });

  it("is a KnowledgeIntelligenceException", () => {
    expect(new InvalidWeightConfigurationException("x")).toBeInstanceOf(
      KnowledgeIntelligenceException,
    );
  });
});
