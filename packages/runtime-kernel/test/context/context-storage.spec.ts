import type { IsoDateTime } from "@aos/types";
import { describe, expect, it } from "vitest";

import { CancellationToken } from "../../src/context/cancellation-token.js";
import {
  getCurrentTenantId,
  getCurrentTraceId,
  getExecutionContext,
  runWithExecutionContext,
} from "../../src/context/context-storage.js";
import type { ExecutionContext } from "../../src/context/execution-context.js";

function buildContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    tenant: { tenantId: "tenant-1" },
    request: { requestId: "req-1", receivedAt: new Date().toISOString() as IsoDateTime },
    trace: { traceId: "trace-1" },
    cancellationToken: CancellationToken.none,
    ...overrides,
  };
}

describe("Context Test — execution context propagation", () => {
  it("getExecutionContext returns undefined outside runWithExecutionContext", () => {
    expect(getExecutionContext()).toBeUndefined();
    expect(getCurrentTenantId()).toBeUndefined();
    expect(getCurrentTraceId()).toBeUndefined();
  });

  it("exposes the provided context inside runWithExecutionContext", () => {
    const context = buildContext();
    runWithExecutionContext(context, () => {
      expect(getExecutionContext()).toBe(context);
      expect(getCurrentTenantId()).toBe("tenant-1");
      expect(getCurrentTraceId()).toBe("trace-1");
    });
  });

  it("isolates nested contexts and restores the outer one afterward", () => {
    const outer = buildContext({ trace: { traceId: "outer" } });
    const inner = buildContext({ trace: { traceId: "inner" } });
    runWithExecutionContext(outer, () => {
      expect(getCurrentTraceId()).toBe("outer");
      runWithExecutionContext(inner, () => {
        expect(getCurrentTraceId()).toBe("inner");
      });
      expect(getCurrentTraceId()).toBe("outer");
    });
    expect(getCurrentTraceId()).toBeUndefined();
  });

  it("propagates context across an async boundary", async () => {
    const context = buildContext({ tenant: { tenantId: "tenant-async" } });
    await runWithExecutionContext(context, async () => {
      await Promise.resolve();
      expect(getCurrentTenantId()).toBe("tenant-async");
    });
  });

  it("getCurrentTenantId returns undefined when the context has no tenant", () => {
    const context = buildContext({ tenant: undefined });
    runWithExecutionContext(context, () => {
      expect(getCurrentTenantId()).toBeUndefined();
    });
  });
});
