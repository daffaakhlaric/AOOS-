import type { IsoDateTime, Uuid } from "@aos/types";
import { describe, expect, it, vi } from "vitest";

import type { RuntimeContext } from "../../src/context/index.js";
import { LifecycleException } from "../../src/errors/index.js";
import type { LifecycleParticipant } from "../../src/interfaces/i-lifecycle-hooks.js";
import { LifecycleManager } from "../../src/lifecycle/lifecycle-manager.js";

const context: RuntimeContext = {
  kernelId: "kernel-1" as Uuid<"KernelId">,
  kernelName: "lifecycle-test-kernel",
  kernelVersion: "0.1.0",
  environment: "test",
  startedAt: new Date().toISOString() as IsoDateTime,
};

describe("Lifecycle Test — LifecycleManager", () => {
  it("invokes each of the six phases only on participants implementing them", async () => {
    const calls: string[] = [];
    const full: LifecycleParticipant = {
      onBootstrap: () => {
        calls.push("bootstrap");
      },
      onReady: () => {
        calls.push("ready");
      },
      onRunning: () => {
        calls.push("running");
      },
      onStopping: () => {
        calls.push("stopping");
      },
      onShutdown: () => {
        calls.push("shutdown");
      },
      onDispose: () => {
        calls.push("dispose");
      },
    };
    const partial: LifecycleParticipant = {
      onBootstrap: () => {
        calls.push("partial-bootstrap");
      },
    };

    const manager = new LifecycleManager();
    manager.register(full);
    manager.register(partial);

    await manager.runBootstrap(context);
    await manager.runReady(context);
    await manager.runRunning(context);
    await manager.runStopping(context);
    await manager.runShutdown(context);
    await manager.runDispose(context);

    expect(calls).toEqual([
      "bootstrap",
      "partial-bootstrap",
      "ready",
      "running",
      "stopping",
      "shutdown",
      "dispose",
    ]);
  });

  it("runs participants in registration order within a single phase", async () => {
    const order: number[] = [];
    const manager = new LifecycleManager();
    manager.register({ onReady: () => void order.push(1) });
    manager.register({ onReady: () => void order.push(2) });

    await manager.runReady(context);

    expect(order).toEqual([1, 2]);
  });

  it("wraps a failing lifecycle method in a LifecycleException", async () => {
    const manager = new LifecycleManager();
    manager.register({
      onBootstrap: () => {
        throw new Error("boom");
      },
    });

    await expect(manager.runBootstrap(context)).rejects.toThrow(LifecycleException);
  });

  it("supports async lifecycle methods", async () => {
    const spy = vi.fn();
    const manager = new LifecycleManager();
    manager.register({
      onRunning: async () => {
        await Promise.resolve();
        spy();
      },
    });

    await manager.runRunning(context);
    expect(spy).toHaveBeenCalled();
  });

  it("participantCount reflects registrations, and unregisterAll clears them", () => {
    const manager = new LifecycleManager();
    manager.register({});
    manager.register({});
    expect(manager.participantCount).toBe(2);
    manager.unregisterAll();
    expect(manager.participantCount).toBe(0);
  });
});
