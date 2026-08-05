import type { IWorkflowIntegrationMiddleware } from "./i-workflow-integration-middleware.js";
import type { WorkflowIntegrationMiddlewareContext } from "./workflow-integration-middleware-context.js";

/**
 * "MIDDLEWARE PIPELINE ... Extensible." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md).
 * A Koa-style middleware chain (`use()` appends, `execute()` runs them in order). Unlike
 * `@aos/workflow-execution`'s equivalent pipeline, this one deliberately allows a stage
 * to call `next()` more than once — `middleware/retry-middleware.ts` needs to re-run the
 * remainder of the chain (Timeout → Logging → Audit → the terminal resolve+adapter call)
 * on every retry attempt.
 */
export class WorkflowIntegrationMiddleware {
  private readonly middlewares: IWorkflowIntegrationMiddleware[] = [];

  use(middleware: IWorkflowIntegrationMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async execute(
    context: WorkflowIntegrationMiddlewareContext,
  ): Promise<WorkflowIntegrationMiddlewareContext> {
    const dispatch = async (index: number): Promise<void> => {
      const middleware = this.middlewares[index];
      if (!middleware) {
        return;
      }
      await middleware.execute(context, () => dispatch(index + 1));
    };

    await dispatch(0);
    return context;
  }
}
