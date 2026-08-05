import { describe, expect, it, vi } from "vitest";

import { RuntimePermissionException } from "../../src/errors/runtime-permission-exception.js";
import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";
import { PermissionMiddleware } from "../../src/middleware/permission-middleware.js";

const factory = new KnowledgeRuntimeFactory();

describe("Middleware Test — PermissionMiddleware", () => {
  it("calls next() when no checker is configured (permissive default)", async () => {
    const middleware = new PermissionMiddleware();
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const next = vi.fn(async () => {});
    await middleware.execute({ execution, operation: "load", metadata: {} }, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("calls next() when the checker allows", async () => {
    const middleware = new PermissionMiddleware({ check: () => true });
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const next = vi.fn(async () => {});
    await middleware.execute({ execution, operation: "load", metadata: {} }, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("throws RuntimePermissionException when the checker denies", async () => {
    const middleware = new PermissionMiddleware({ check: () => false });
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const next = vi.fn(async () => {});
    await expect(
      middleware.execute({ execution, operation: "load", metadata: {} }, next),
    ).rejects.toThrow(RuntimePermissionException);
    expect(next).not.toHaveBeenCalled();
  });
});
