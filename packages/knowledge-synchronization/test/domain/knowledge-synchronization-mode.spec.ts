import { describe, expect, it } from "vitest";

import { KnowledgeSynchronizationMode } from "../../src/domain/knowledge-synchronization-mode.js";

describe("KnowledgeSynchronizationMode", () => {
  it("has exactly 7 modes", () => {
    expect(Object.values(KnowledgeSynchronizationMode)).toHaveLength(7);
  });

  it("includes MANUAL, SCHEDULED, REAL_TIME, WEBHOOK, STREAMING", () => {
    expect(KnowledgeSynchronizationMode.MANUAL).toBe("manual");
    expect(KnowledgeSynchronizationMode.SCHEDULED).toBe("scheduled");
    expect(KnowledgeSynchronizationMode.REAL_TIME).toBe("real_time");
    expect(KnowledgeSynchronizationMode.WEBHOOK).toBe("webhook");
    expect(KnowledgeSynchronizationMode.STREAMING).toBe("streaming");
  });
});
