import { describe, expect, it, vi } from "vitest";

import { RuntimeValidationException } from "../../src/errors/runtime-validation-exception.js";
import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";
import { ValidationMiddleware } from "../../src/middleware/validation-middleware.js";
import { KnowledgeRuntimeValidator } from "../../src/validator/knowledge-runtime-validator.js";

const factory = new KnowledgeRuntimeFactory();

describe("Middleware Test — ValidationMiddleware", () => {
  it("calls next() when the Execution is valid", async () => {
    const middleware = new ValidationMiddleware(new KnowledgeRuntimeValidator());
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const next = vi.fn(async () => {});
    await middleware.execute({ execution, operation: "load", metadata: {} }, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("throws RuntimeValidationException without calling next() when invalid", async () => {
    const middleware = new ValidationMiddleware(new KnowledgeRuntimeValidator());
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const invalid = { ...execution, instance: { ...execution.instance, token: "bad" } };
    const next = vi.fn(async () => {});
    await expect(
      middleware.execute({ execution: invalid, operation: "load", metadata: {} }, next),
    ).rejects.toThrow(RuntimeValidationException);
    expect(next).not.toHaveBeenCalled();
  });
});
