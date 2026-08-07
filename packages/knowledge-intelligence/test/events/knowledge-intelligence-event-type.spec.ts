import { describe, expect, it } from "vitest";

import { KnowledgeIntelligenceEventType } from "../../src/events/knowledge-intelligence-event-type.js";

describe("KnowledgeIntelligenceEventType", () => {
  it("defines exactly the 14 spec'd events", () => {
    const values = Object.values(KnowledgeIntelligenceEventType);
    expect(values).toHaveLength(14);
  });

  it("prefixes every event with the package namespace", () => {
    for (const value of Object.values(KnowledgeIntelligenceEventType)) {
      expect(value).toMatch(/^knowledge_intelligence\./);
    }
  });

  it("has unique values", () => {
    const values = Object.values(KnowledgeIntelligenceEventType);
    expect(new Set(values).size).toBe(values.length);
  });

  it("includes the required event names", () => {
    expect(KnowledgeIntelligenceEventType.IntelligenceStarted).toBe(
      "knowledge_intelligence.intelligence_started",
    );
    expect(KnowledgeIntelligenceEventType.ReportGenerated).toBe(
      "knowledge_intelligence.report_generated",
    );
    expect(KnowledgeIntelligenceEventType.ClassificationCompleted).toBe(
      "knowledge_intelligence.classification_completed",
    );
  });
});
