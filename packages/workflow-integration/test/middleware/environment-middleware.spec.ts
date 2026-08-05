import { describe, expect, it, vi } from "vitest";

import { IntegrationValidationException } from "../../src/errors/integration-validation-exception.js";
import { EnvironmentMiddleware } from "../../src/middleware/environment-middleware.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { middlewareContextFixture } from "../helpers/middleware-context-fixture.js";

describe("Middleware Test — EnvironmentMiddleware", () => {
  it("calls next() when allowedEnvironments is not configured", async () => {
    const middleware = new EnvironmentMiddleware();
    const next = vi.fn(async () => {});
    await middleware.execute(
      middlewareContextFixture({ context: contextFixture({ environment: "staging" }) }),
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("calls next() when the Context's environment is in the allow-list", async () => {
    const middleware = new EnvironmentMiddleware(["production"]);
    const next = vi.fn(async () => {});
    await middleware.execute(
      middlewareContextFixture({ context: contextFixture({ environment: "production" }) }),
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("throws IntegrationValidationException when the environment is not allowed", async () => {
    const middleware = new EnvironmentMiddleware(["production"]);
    const next = vi.fn(async () => {});
    await expect(
      middleware.execute(
        middlewareContextFixture({ context: contextFixture({ environment: "staging" }) }),
        next,
      ),
    ).rejects.toThrow(IntegrationValidationException);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when the Context has no environment set", async () => {
    const middleware = new EnvironmentMiddleware(["production"]);
    const next = vi.fn(async () => {});
    await middleware.execute(middlewareContextFixture(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
