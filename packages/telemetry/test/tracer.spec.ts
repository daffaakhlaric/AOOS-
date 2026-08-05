import { describe, expect, it } from "vitest";

import { getTracer, initTracing } from "../src/tracer.js";

describe("tracing bootstrap", () => {
  it("initializes a tracer provider and produces a working, non-recording-safe tracer", async () => {
    const handle = initTracing({ serviceName: "aos-telemetry-test" });
    try {
      const tracer = getTracer("test-tracer");
      const span = tracer.startSpan("test-span");
      expect(span).toBeDefined();
      span.end();
    } finally {
      await handle.shutdown();
    }
  });
});
