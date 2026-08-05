import { describe, expect, it } from "vitest";

import { KnowledgeSynchronizationJobType } from "../../src/domain/knowledge-synchronization-job-type.js";

describe("KnowledgeSynchronizationJobType", () => {
  it("has exactly 10 job types", () => {
    expect(Object.values(KnowledgeSynchronizationJobType)).toHaveLength(10);
  });

  it("includes MANUAL_SYNC, FULL_SYNC, TEMPLATE_SYNC", () => {
    expect(KnowledgeSynchronizationJobType.MANUAL_SYNC).toBe("manual_sync");
    expect(KnowledgeSynchronizationJobType.FULL_SYNC).toBe("full_sync");
    expect(KnowledgeSynchronizationJobType.TEMPLATE_SYNC).toBe("template_sync");
  });
});
