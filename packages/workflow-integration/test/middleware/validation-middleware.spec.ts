import { describe, expect, it, vi } from "vitest";

import { CapabilityAdapter } from "../../src/adapter/capability-adapter.js";
import { IntegrationValidationException } from "../../src/errors/integration-validation-exception.js";
import { ValidationMiddleware } from "../../src/middleware/validation-middleware.js";
import { WorkflowIntegrationRegistry } from "../../src/registry/workflow-integration-registry.js";
import { middlewareContextFixture } from "../helpers/middleware-context-fixture.js";
import { successfulRuntime } from "../helpers/runtime-fixture.js";

describe("Middleware Test — ValidationMiddleware", () => {
  it("calls next() when the Registry is valid", async () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime()));
    const middleware = new ValidationMiddleware(registry);
    const next = vi.fn(async () => {});

    await middleware.execute(middlewareContextFixture(), next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("throws IntegrationValidationException when the Registry is invalid", async () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm"));
    const middleware = new ValidationMiddleware(registry);
    const next = vi.fn(async () => {});

    await expect(middleware.execute(middlewareContextFixture(), next)).rejects.toThrow(
      IntegrationValidationException,
    );
    expect(next).not.toHaveBeenCalled();
  });
});
