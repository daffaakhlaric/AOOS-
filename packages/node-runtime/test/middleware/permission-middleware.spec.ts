import { describe, expect, it, vi } from "vitest";

import { NodePermissionException } from "../../src/errors/node-permission-exception.js";
import type { NodeMiddlewareContext } from "../../src/middleware/i-node-middleware.js";
import { PermissionMiddleware } from "../../src/middleware/permission-middleware.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Node Middleware Test — PermissionMiddleware", () => {
  it("calls next() with no checker configured (permissive default)", async () => {
    const middleware = new PermissionMiddleware();
    const next = vi.fn(async () => {});
    const context: NodeMiddlewareContext = {
      execution: executionFixture(),
      operation: "start",
      metadata: {},
    };
    await middleware.execute(context, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("throws NodePermissionException when a supplied checker denies", async () => {
    const middleware = new PermissionMiddleware({ check: vi.fn(async () => false) });
    const next = vi.fn(async () => {});
    const context: NodeMiddlewareContext = {
      execution: executionFixture(),
      operation: "start",
      metadata: {},
    };
    await expect(middleware.execute(context, next)).rejects.toThrow(NodePermissionException);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when a supplied checker allows", async () => {
    const middleware = new PermissionMiddleware({ check: vi.fn(async () => true) });
    const next = vi.fn(async () => {});
    const context: NodeMiddlewareContext = {
      execution: executionFixture(),
      operation: "start",
      metadata: {},
    };
    await middleware.execute(context, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
