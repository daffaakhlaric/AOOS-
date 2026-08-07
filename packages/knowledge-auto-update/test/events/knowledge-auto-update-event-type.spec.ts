import { describe, expect, it } from "vitest";

import { KnowledgeAutoUpdateEventType } from "../../src/events/knowledge-auto-update-event-type.js";

describe("KnowledgeAutoUpdateEventType", () => {
  it("defines exactly the 13 spec events", () => {
    const values = Object.values(KnowledgeAutoUpdateEventType);
    expect(values).toHaveLength(13);
  });

  it("every value is dotted and namespaced under knowledge_auto_update", () => {
    for (const value of Object.values(KnowledgeAutoUpdateEventType)) {
      expect(value.startsWith("knowledge_auto_update.")).toBe(true);
    }
  });

  it("includes UpdateStarted and ReportGenerated", () => {
    expect(KnowledgeAutoUpdateEventType.UpdateStarted).toBe("knowledge_auto_update.update_started");
    expect(KnowledgeAutoUpdateEventType.ReportGenerated).toBe(
      "knowledge_auto_update.report_generated",
    );
  });

  it("has no duplicate values", () => {
    const values = Object.values(KnowledgeAutoUpdateEventType);
    expect(new Set(values).size).toBe(values.length);
  });
});
