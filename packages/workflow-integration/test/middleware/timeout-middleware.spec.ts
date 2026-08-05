import { describe, expect, it } from "vitest";

import { IntegrationTimeoutException } from "../../src/errors/integration-timeout-exception.js";
import { WorkflowIntegrationMetrics } from "../../src/metrics/workflow-integration-metrics.js";
import { TimeoutMiddleware } from "../../src/middleware/timeout-middleware.js";
import { middlewareContextFixture } from "../helpers/middleware-context-fixture.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Middleware Test — TimeoutMiddleware", () => {
  it("calls next() without racing a timer when timeoutMs is not configured", async () => {
    const middleware = new TimeoutMiddleware();
    let called = false;
    await middleware.execute(middlewareContextFixture(), async () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it("resolves normally when next() finishes before the timeout", async () => {
    const middleware = new TimeoutMiddleware(200);
    let called = false;
    await middleware.execute(middlewareContextFixture(), async () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it("throws IntegrationTimeoutException and records a timeout metric when next() exceeds timeoutMs", async () => {
    const metrics = new WorkflowIntegrationMetrics();
    const middleware = new TimeoutMiddleware(10, metrics);

    await expect(middleware.execute(middlewareContextFixture(), () => delay(200))).rejects.toThrow(
      IntegrationTimeoutException,
    );
    expect(metrics.snapshot().timeouts).toBe(1);
  });
});
