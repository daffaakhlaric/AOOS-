import { describe, expect, it } from "vitest";

import { KnowledgeSynchronizationScheduleType } from "../../src/domain/knowledge-synchronization-schedule-type.js";

describe("KnowledgeSynchronizationScheduleType", () => {
  it("has exactly 5 schedule types", () => {
    expect(Object.values(KnowledgeSynchronizationScheduleType)).toHaveLength(5);
  });

  it("includes CRON, EVENT_TRIGGER", () => {
    expect(KnowledgeSynchronizationScheduleType.CRON).toBe("cron");
    expect(KnowledgeSynchronizationScheduleType.EVENT_TRIGGER).toBe("event_trigger");
  });
});
