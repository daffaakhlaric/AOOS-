import type { IsoDateTime, Uuid } from "@aos/types";
import { describe, expect, it, vi } from "vitest";

import type { RuntimeContext } from "../../src/context/index.js";
import { LifecycleException } from "../../src/errors/index.js";
import { HookRegistry } from "../../src/hooks/hook-registry.js";
import { HookName } from "../../src/types/index.js";

const context: RuntimeContext = {
  kernelId: "kernel-1" as Uuid<"KernelId">,
  kernelName: "test-kernel",
  kernelVersion: "0.1.0",
  environment: "test",
  startedAt: new Date().toISOString() as IsoDateTime,
};

describe("HookRegistry", () => {
  it("runs registered handlers in registration order", async () => {
    const registry = new HookRegistry();
    const order: number[] = [];
    registry.register(HookName.BEFORE_START, () => {
      order.push(1);
    });
    registry.register(HookName.BEFORE_START, () => {
      order.push(2);
    });

    await registry.run(HookName.BEFORE_START, context);

    expect(order).toEqual([1, 2]);
  });

  it("run() is a no-op when no handlers are registered for a hook", async () => {
    const registry = new HookRegistry();
    await expect(registry.run(HookName.AFTER_STOP, context)).resolves.toBeUndefined();
  });

  it("unregister() removes a specific handler", async () => {
    const registry = new HookRegistry();
    const handler = vi.fn();
    registry.register(HookName.AFTER_START, handler);
    registry.unregister(HookName.AFTER_START, handler);

    await registry.run(HookName.AFTER_START, context);

    expect(handler).not.toHaveBeenCalled();
  });

  it("unregister() on a hook with no handlers is a safe no-op", () => {
    const registry = new HookRegistry();
    expect(() => registry.unregister(HookName.BEFORE_RELOAD, () => undefined)).not.toThrow();
  });

  it("wraps a failing handler in a LifecycleException", async () => {
    const registry = new HookRegistry();
    registry.register(HookName.BEFORE_STOP, () => {
      throw new Error("handler failed");
    });

    await expect(registry.run(HookName.BEFORE_STOP, context)).rejects.toThrow(LifecycleException);
  });

  it("count() reports the number of handlers registered for a hook", () => {
    const registry = new HookRegistry();
    expect(registry.count(HookName.AFTER_RELOAD)).toBe(0);
    registry.register(HookName.AFTER_RELOAD, () => undefined);
    registry.register(HookName.AFTER_RELOAD, () => undefined);
    expect(registry.count(HookName.AFTER_RELOAD)).toBe(2);
  });
});
