import { describe, expect, it } from "vitest";

import { DEFAULT_EVENT_BUS_CONFIG } from "../../src/config/event-bus-config.js";

describe("DEFAULT_EVENT_BUS_CONFIG", () => {
  it("defaults maxBatchSize to 500", () => {
    expect(DEFAULT_EVENT_BUS_CONFIG.maxBatchSize).toBe(500);
  });
});
