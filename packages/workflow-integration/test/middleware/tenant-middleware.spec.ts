import { describe, expect, it, vi } from "vitest";

import { IntegrationValidationException } from "../../src/errors/integration-validation-exception.js";
import { TenantMiddleware } from "../../src/middleware/tenant-middleware.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { middlewareContextFixture } from "../helpers/middleware-context-fixture.js";

describe("Middleware Test — TenantMiddleware", () => {
  it("calls next() when requireTenantId is false (default)", async () => {
    const middleware = new TenantMiddleware();
    const next = vi.fn(async () => {});
    await middleware.execute(middlewareContextFixture(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("calls next() when requireTenantId is true and the Context has a tenantId", async () => {
    const middleware = new TenantMiddleware(true);
    const next = vi.fn(async () => {});
    await middleware.execute(
      middlewareContextFixture({ context: contextFixture({ tenantId: "tenant-1" }) }),
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("throws IntegrationValidationException when requireTenantId is true and the Context has no tenantId", async () => {
    const middleware = new TenantMiddleware(true);
    const next = vi.fn(async () => {});
    await expect(middleware.execute(middlewareContextFixture(), next)).rejects.toThrow(
      IntegrationValidationException,
    );
    expect(next).not.toHaveBeenCalled();
  });
});
