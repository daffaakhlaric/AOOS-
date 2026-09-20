import { describe, expect, it, vi } from "vitest";

import { TaskWakeRegistry } from "../../../src/infrastructure/polling/TaskWakeRegistry.js";

describe("TaskWakeRegistry", () => {
  it("wake() returns false when nothing is waiting for that taskId", () => {
    const registry = new TaskWakeRegistry();
    expect(registry.wake("task_never_registered")).toBe(false);
  });

  it("wake() resolves a waiter's promise and returns true", async () => {
    const registry = new TaskWakeRegistry();
    const waiter = registry.waitForWake("task_1");
    const spy = vi.fn();
    void waiter.promise.then(spy);

    expect(registry.wake("task_1")).toBe(true);
    await waiter.promise;
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("wake() is idempotent — calling it twice for the same taskId is safe, second call no-ops", async () => {
    const registry = new TaskWakeRegistry();
    const waiter = registry.waitForWake("task_1");

    expect(registry.wake("task_1")).toBe(true);
    await waiter.promise;
    expect(registry.wake("task_1")).toBe(false);
  });

  it("wakes every waiter registered for the same taskId", async () => {
    const registry = new TaskWakeRegistry();
    const waiterA = registry.waitForWake("task_1");
    const waiterB = registry.waitForWake("task_1");

    expect(registry.wake("task_1")).toBe(true);
    await Promise.all([waiterA.promise, waiterB.promise]);
  });

  it("only wakes waiters for the matching taskId, not other tasks", async () => {
    const registry = new TaskWakeRegistry();
    const waiterOther = registry.waitForWake("task_other");
    const spyOther = vi.fn();
    void waiterOther.promise.then(spyOther);

    registry.wake("task_1");
    await Promise.resolve();
    expect(spyOther).not.toHaveBeenCalled();

    waiterOther.cancel();
  });

  it("cancel() removes a waiter so a later wake() finds nothing (never resolves a cancelled waiter)", async () => {
    const registry = new TaskWakeRegistry();
    const waiter = registry.waitForWake("task_1");
    const spy = vi.fn();
    void waiter.promise.then(spy);

    waiter.cancel();
    expect(registry.wake("task_1")).toBe(false);
    await Promise.resolve();
    expect(spy).not.toHaveBeenCalled();
  });

  it("cancel() on one of several waiters for the same taskId leaves the others wakeable", async () => {
    const registry = new TaskWakeRegistry();
    const waiterA = registry.waitForWake("task_1");
    const waiterB = registry.waitForWake("task_1");

    waiterA.cancel();
    expect(registry.wake("task_1")).toBe(true);
    await waiterB.promise;
  });

  it("cancel() is safe to call twice", () => {
    const registry = new TaskWakeRegistry();
    const waiter = registry.waitForWake("task_1");
    waiter.cancel();
    expect(() => {
      waiter.cancel();
    }).not.toThrow();
  });
});
