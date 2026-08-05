import { describe, expect, it } from "vitest";

import { WorkflowIntegrationMetrics } from "../../src/metrics/workflow-integration-metrics.js";
import { RetryMiddleware } from "../../src/middleware/retry-middleware.js";
import { RetryStrategy } from "../../src/retry/retry-policy.js";
import { middlewareContextFixture } from "../helpers/middleware-context-fixture.js";

describe("Middleware Test — RetryMiddleware", () => {
  it("calls next() exactly once when no RetryPolicy is configured", async () => {
    const middleware = new RetryMiddleware();
    let calls = 0;
    await middleware.execute(middlewareContextFixture(), async () => {
      calls += 1;
    });
    expect(calls).toBe(1);
  });

  it("does not retry when the first attempt succeeds", async () => {
    const middleware = new RetryMiddleware({ strategy: RetryStrategy.IMMEDIATE, maxAttempts: 3 });
    const mwContext = middlewareContextFixture();
    let calls = 0;
    await middleware.execute(mwContext, async () => {
      calls += 1;
      mwContext.result = { success: true };
    });
    expect(calls).toBe(1);
  });

  it("retries maxAttempts times beyond the initial call, then stops with the last failing result", async () => {
    const metrics = new WorkflowIntegrationMetrics();
    const middleware = new RetryMiddleware(
      { strategy: RetryStrategy.IMMEDIATE, maxAttempts: 3 },
      metrics,
    );
    const mwContext = middlewareContextFixture();
    let calls = 0;
    await middleware.execute(mwContext, async () => {
      calls += 1;
      mwContext.result = { success: false, error: `attempt-${calls}` };
    });
    // 1 initial call + 3 retries = 4 total calls, matching @aos/workflow-execution's
    // established RetryCoordinator semantics (maxAttempts caps recorded retry attempts,
    // not total calls).
    expect(calls).toBe(4);
    expect(mwContext.result).toEqual({ success: false, error: "attempt-4" });
    expect(metrics.snapshot().retries).toBe(3);
  });

  it("stops retrying once a later attempt succeeds", async () => {
    const middleware = new RetryMiddleware({ strategy: RetryStrategy.IMMEDIATE, maxAttempts: 5 });
    const mwContext = middlewareContextFixture();
    let calls = 0;
    await middleware.execute(mwContext, async () => {
      calls += 1;
      mwContext.result = calls < 2 ? { success: false, error: "fail" } : { success: true };
    });
    expect(calls).toBe(2);
    expect(mwContext.result).toEqual({ success: true });
  });
});
