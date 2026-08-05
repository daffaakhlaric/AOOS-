import { describe, expect, it } from "vitest";

import { EVENT_PRIORITY_ORDER, EventPriority } from "../../src/contracts/event-priority.js";

describe("Priority Test — EVENT_PRIORITY_ORDER", () => {
  it("orders Critical first and Background last", () => {
    expect(EVENT_PRIORITY_ORDER[0]).toBe(EventPriority.CRITICAL);
    expect(EVENT_PRIORITY_ORDER[EVENT_PRIORITY_ORDER.length - 1]).toBe(EventPriority.BACKGROUND);
  });

  it("contains every EventPriority value exactly once", () => {
    const values = Object.values(EventPriority);
    expect(new Set(EVENT_PRIORITY_ORDER).size).toBe(values.length);
    for (const value of values) {
      expect(EVENT_PRIORITY_ORDER).toContain(value);
    }
  });
});
