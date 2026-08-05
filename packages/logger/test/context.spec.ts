import { describe, expect, it } from "vitest";

import { getLogContext, withLogContext } from "../src/context.js";

describe("log context", () => {
  it("returns an empty object outside of withLogContext", () => {
    expect(getLogContext()).toEqual({});
  });

  it("exposes the provided context inside withLogContext", () => {
    withLogContext({ traceId: "trace-1", tenantId: "tenant-1" }, () => {
      expect(getLogContext()).toEqual({ traceId: "trace-1", tenantId: "tenant-1" });
    });
  });

  it("isolates context across nested/sequential calls", () => {
    withLogContext({ traceId: "outer" }, () => {
      expect(getLogContext().traceId).toBe("outer");
      withLogContext({ traceId: "inner" }, () => {
        expect(getLogContext().traceId).toBe("inner");
      });
      expect(getLogContext().traceId).toBe("outer");
    });
    expect(getLogContext()).toEqual({});
  });

  it("propagates context across an async boundary", async () => {
    await withLogContext({ requestId: "req-1" }, async () => {
      await Promise.resolve();
      expect(getLogContext().requestId).toBe("req-1");
    });
  });
});
