import { describe, expect, it, vi } from "vitest";

import { IntegrationPermissionException } from "../../src/errors/integration-permission-exception.js";
import { PermissionMiddleware } from "../../src/middleware/permission-middleware.js";
import { middlewareContextFixture } from "../helpers/middleware-context-fixture.js";

describe("Middleware Test — PermissionMiddleware", () => {
  it("calls next() when no checker is configured (permissive default)", async () => {
    const middleware = new PermissionMiddleware();
    const next = vi.fn(async () => {});
    await middleware.execute(middlewareContextFixture(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("calls next() when the checker allows the namespace", async () => {
    const middleware = new PermissionMiddleware({ check: () => true });
    const next = vi.fn(async () => {});
    await middleware.execute(middlewareContextFixture(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("throws IntegrationPermissionException when the checker denies the namespace", async () => {
    const middleware = new PermissionMiddleware({ check: () => false });
    const next = vi.fn(async () => {});
    await expect(middleware.execute(middlewareContextFixture(), next)).rejects.toThrow(
      IntegrationPermissionException,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("supports an async checker", async () => {
    const middleware = new PermissionMiddleware({ check: async () => true });
    const next = vi.fn(async () => {});
    await middleware.execute(middlewareContextFixture(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
