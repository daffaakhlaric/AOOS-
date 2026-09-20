import type { ITaskWakeRegistry } from "@aos/creative-connector";
import { describe, expect, it, vi } from "vitest";

import type { KieWebhookBodyDto } from "./dto/kie-webhook.dto.js";
import { KieWebhookService } from "./kie-webhook.service.js";

function fakeBody(taskId: string): KieWebhookBodyDto {
  return { data: { taskId } };
}

describe("KieWebhookService", () => {
  it("wakes the matching in-flight poll and reports handled: true", () => {
    const wakeRegistry: ITaskWakeRegistry = {
      waitForWake: vi.fn(),
      wake: vi.fn(() => true),
    };
    const service = new KieWebhookService(wakeRegistry);

    const result = service.handleCallback(fakeBody("task_1"), "corr-1");

    expect(result).toEqual({ received: true, handled: true });
    expect(wakeRegistry.wake).toHaveBeenCalledWith("task_1");
  });

  it("a duplicate callback for an already-resolved taskId is a safe, idempotent no-op — handled: false, never throws", () => {
    const wakeRegistry: ITaskWakeRegistry = {
      waitForWake: vi.fn(),
      wake: vi.fn(() => false),
    };
    const service = new KieWebhookService(wakeRegistry);

    const first = service.handleCallback(fakeBody("task_1"), "corr-1");
    const second = service.handleCallback(fakeBody("task_1"), "corr-2");

    expect(first).toEqual({ received: true, handled: false });
    expect(second).toEqual({ received: true, handled: false });
    expect(wakeRegistry.wake).toHaveBeenCalledTimes(2);
  });

  it("an unknown taskId is honestly handled as handled: false — never crashes", () => {
    const wakeRegistry: ITaskWakeRegistry = {
      waitForWake: vi.fn(),
      wake: vi.fn(() => false),
    };
    const service = new KieWebhookService(wakeRegistry);

    expect(() => {
      const result = service.handleCallback(fakeBody("task_never_existed"), "corr-1");
      expect(result).toEqual({ received: true, handled: false });
    }).not.toThrow();
  });

  it("degrades honestly (handled: false, never throws) when no TaskWakeRegistry is composed on this deployment", () => {
    const service = new KieWebhookService(undefined);

    expect(() => {
      const result = service.handleCallback(fakeBody("task_1"), "corr-1");
      expect(result).toEqual({ received: true, handled: false });
    }).not.toThrow();
  });
});
