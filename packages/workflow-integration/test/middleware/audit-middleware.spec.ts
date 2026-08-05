import { describe, expect, it, vi } from "vitest";

import { AuditMiddleware } from "../../src/middleware/audit-middleware.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { middlewareContextFixture } from "../helpers/middleware-context-fixture.js";

describe("Middleware Test — AuditMiddleware", () => {
  it("calls next() and is a no-op when no sink is configured", async () => {
    const middleware = new AuditMiddleware();
    const next = vi.fn(async () => {});
    await middleware.execute(middlewareContextFixture(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("records an AuditEntry via the configured sink after next() completes", async () => {
    const record = vi.fn();
    const middleware = new AuditMiddleware({ record });
    const mwContext = middlewareContextFixture({
      context: contextFixture({ tenantId: "tenant-1", userId: "user-1" }),
    });

    await middleware.execute(mwContext, async () => {
      mwContext.result = { success: true };
    });

    expect(record).toHaveBeenCalledTimes(1);
    const entry = record.mock.calls[0]?.[0];
    expect(entry).toMatchObject({
      namespace: mwContext.namespace,
      tenantId: "tenant-1",
      userId: "user-1",
      success: true,
    });
    expect(entry.occurredAt).toEqual(expect.any(String));
  });
});
