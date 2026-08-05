import { describe, expect, it, vi } from "vitest";

import { RuntimePolicyException } from "../../src/errors/runtime-policy-exception.js";
import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";
import { PolicyMiddleware } from "../../src/middleware/policy-middleware.js";

const factory = new KnowledgeRuntimeFactory();

describe("Middleware Test — PolicyMiddleware", () => {
  it("calls next() when no checker is configured (permissive default)", async () => {
    const middleware = new PolicyMiddleware();
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const next = vi.fn(async () => {});
    await middleware.execute({ execution, operation: "load", metadata: {} }, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("throws RuntimePolicyException when the checker denies", async () => {
    const middleware = new PolicyMiddleware({ check: () => false });
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const next = vi.fn(async () => {});
    await expect(
      middleware.execute({ execution, operation: "load", metadata: {} }, next),
    ).rejects.toThrow(RuntimePolicyException);
    expect(next).not.toHaveBeenCalled();
  });
});
