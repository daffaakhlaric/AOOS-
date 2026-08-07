import { describe, expect, it } from "vitest";

import { KnowledgeIntelligenceException } from "../../src/errors/knowledge-intelligence-exception.js";
import { RecommendationNotFoundException } from "../../src/errors/recommendation-not-found-exception.js";

describe("RecommendationNotFoundException", () => {
  it("carries the recommendation id and a stable code", () => {
    const error = new RecommendationNotFoundException("rec-1");
    expect(error.code).toBe("RECOMMENDATION_NOT_FOUND");
    expect(error.context).toEqual({ recommendationId: "rec-1" });
  });

  it("is a KnowledgeIntelligenceException", () => {
    expect(new RecommendationNotFoundException("x")).toBeInstanceOf(KnowledgeIntelligenceException);
  });
});
