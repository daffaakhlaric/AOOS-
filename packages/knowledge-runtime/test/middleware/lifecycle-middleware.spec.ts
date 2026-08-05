import { describe, expect, it, vi } from "vitest";

import { KnowledgeRuntimeState } from "../../src/domain/knowledge-runtime-state.js";
import { RuntimeLifecycleException } from "../../src/errors/runtime-lifecycle-exception.js";
import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";
import { KnowledgeRuntimeLifecycle } from "../../src/lifecycle/knowledge-runtime-lifecycle.js";
import { LifecycleMiddleware } from "../../src/middleware/lifecycle-middleware.js";
import { KnowledgeRuntimeStateMachine } from "../../src/state-machine/knowledge-runtime-state-machine.js";

const factory = new KnowledgeRuntimeFactory();

describe("Middleware Test — LifecycleMiddleware", () => {
  it("applies the named operation and writes the result back onto context.execution", async () => {
    const lifecycle = new KnowledgeRuntimeLifecycle(new KnowledgeRuntimeStateMachine());
    const middleware = new LifecycleMiddleware(lifecycle);
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const context = { execution, operation: "load", metadata: {} };
    const next = vi.fn(async () => {});
    await middleware.execute(context, next);
    expect(context.execution.instance.state).toBe(KnowledgeRuntimeState.LOADING);
    expect(next).toHaveBeenCalledOnce();
  });

  it("passes reason through for suspend/fail/cancel", async () => {
    const lifecycle = new KnowledgeRuntimeLifecycle(new KnowledgeRuntimeStateMachine());
    const middleware = new LifecycleMiddleware(lifecycle);
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const context = { execution, operation: "cancel", metadata: { reason: "no longer needed" } };
    await middleware.execute(
      context,
      vi.fn(async () => {}),
    );
    expect(context.execution.instance.state).toBe(KnowledgeRuntimeState.CANCELLED);
  });

  it("throws RuntimeLifecycleException for an unknown operation", async () => {
    const lifecycle = new KnowledgeRuntimeLifecycle(new KnowledgeRuntimeStateMachine());
    const middleware = new LifecycleMiddleware(lifecycle);
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    await expect(
      middleware.execute(
        { execution, operation: "bogus", metadata: {} },
        vi.fn(async () => {}),
      ),
    ).rejects.toThrow(RuntimeLifecycleException);
  });
});
