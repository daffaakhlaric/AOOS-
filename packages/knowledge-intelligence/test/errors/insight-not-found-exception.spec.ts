import { describe, expect, it } from "vitest";

import { InsightNotFoundException } from "../../src/errors/insight-not-found-exception.js";
import { KnowledgeIntelligenceException } from "../../src/errors/knowledge-intelligence-exception.js";

describe("InsightNotFoundException", () => {
  it("carries the insight id and a stable code", () => {
    const error = new InsightNotFoundException("insight-1");
    expect(error.code).toBe("INSIGHT_NOT_FOUND");
    expect(error.context).toEqual({ insightId: "insight-1" });
  });

  it("is a KnowledgeIntelligenceException", () => {
    expect(new InsightNotFoundException("x")).toBeInstanceOf(KnowledgeIntelligenceException);
  });
});
