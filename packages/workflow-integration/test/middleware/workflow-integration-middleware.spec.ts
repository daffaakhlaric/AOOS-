import { describe, expect, it } from "vitest";

import type {
  IWorkflowIntegrationMiddleware,
  WorkflowIntegrationMiddlewareNext,
} from "../../src/middleware/i-workflow-integration-middleware.js";
import type { WorkflowIntegrationMiddlewareContext } from "../../src/middleware/workflow-integration-middleware-context.js";
import { WorkflowIntegrationMiddleware } from "../../src/middleware/workflow-integration-middleware.js";
import { middlewareContextFixture } from "../helpers/middleware-context-fixture.js";

function recordingMiddleware(name: string, calls: string[]): IWorkflowIntegrationMiddleware {
  return {
    name,
    async execute(
      _mwContext: WorkflowIntegrationMiddlewareContext,
      next: WorkflowIntegrationMiddlewareNext,
    ) {
      calls.push(`${name}:before`);
      await next();
      calls.push(`${name}:after`);
    },
  };
}

describe("Middleware Test — WorkflowIntegrationMiddleware", () => {
  it("runs middlewares in registration order, each wrapping the next", async () => {
    const calls: string[] = [];
    const pipeline = new WorkflowIntegrationMiddleware()
      .use(recordingMiddleware("a", calls))
      .use(recordingMiddleware("b", calls));

    await pipeline.execute(middlewareContextFixture());

    expect(calls).toEqual(["a:before", "b:before", "b:after", "a:after"]);
  });

  it("completes without error when no middlewares are registered", async () => {
    const pipeline = new WorkflowIntegrationMiddleware();
    const mwContext = middlewareContextFixture();
    const outcome = await pipeline.execute(mwContext);
    expect(outcome).toBe(mwContext);
  });

  it("allows a middleware to call next() more than once (Retry needs this)", async () => {
    let nextCalls = 0;
    const pipeline = new WorkflowIntegrationMiddleware().use({
      name: "double-next",
      async execute(_mwContext, next) {
        await next();
        nextCalls += 1;
        await next();
      },
    });

    await pipeline.execute(middlewareContextFixture());

    expect(nextCalls).toBe(1);
  });

  it("propagates an error thrown by a middleware", async () => {
    const pipeline = new WorkflowIntegrationMiddleware().use({
      name: "throwing",
      async execute() {
        throw new Error("boom");
      },
    });

    await expect(pipeline.execute(middlewareContextFixture())).rejects.toThrow("boom");
  });
});
