import { describe, expect, it } from "vitest";

import { getMeter, initMetrics } from "../src/metrics.js";

describe("metrics bootstrap", () => {
  it("initializes a meter provider and produces a working counter instrument", async () => {
    const handle = initMetrics({ serviceName: "aos-telemetry-test" });
    try {
      const meter = getMeter("test-meter");
      const counter = meter.createCounter("test_counter");
      expect(() => counter.add(1)).not.toThrow();
    } finally {
      await handle.shutdown();
    }
  });
});
