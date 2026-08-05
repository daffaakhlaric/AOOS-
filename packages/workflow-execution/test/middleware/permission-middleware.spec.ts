import { describe, expect, it, vi } from "vitest";

import { WorkflowExecutionException } from "../../src/errors/workflow-execution-exception.js";
import { PermissionMiddleware } from "../../src/middleware/permission-middleware.js";
import { sessionFixture } from "../helpers/session-fixture.js";

describe("Middleware Test — PermissionMiddleware", () => {
  it("calls next() when no checker is configured (permissive default)", async () => {
    const middleware = new PermissionMiddleware();
    const { session } = sessionFixture();
    const next = vi.fn(async () => {});

    await middleware.execute({ session, operation: "start", metadata: {} }, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("calls next() when the checker allows the operation", async () => {
    const middleware = new PermissionMiddleware({ check: () => true });
    const { session } = sessionFixture();
    const next = vi.fn(async () => {});

    await middleware.execute({ session, operation: "start", metadata: {} }, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("throws WorkflowExecutionException when the checker denies the operation", async () => {
    const middleware = new PermissionMiddleware({ check: () => false });
    const { session } = sessionFixture();
    const next = vi.fn(async () => {});

    await expect(
      middleware.execute({ session, operation: "start", metadata: {} }, next),
    ).rejects.toThrow(WorkflowExecutionException);
    expect(next).not.toHaveBeenCalled();
  });

  it("supports an async checker", async () => {
    const middleware = new PermissionMiddleware({ check: async () => true });
    const { session } = sessionFixture();
    const next = vi.fn(async () => {});

    await middleware.execute({ session, operation: "start", metadata: {} }, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
