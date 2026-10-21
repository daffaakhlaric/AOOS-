import type { ITaskWakeRegistry } from "@aos/creative-connector";
import { describe, expect, it, vi } from "vitest";

import type { KieWebhookBodyDto } from "./dto/kie-webhook.dto.js";
import type { KaiProductionRepository } from "./infrastructure/kai-production.repository.js";
import { KieWebhookService } from "./kie-webhook.service.js";

function fakeBody(taskId: string): KieWebhookBodyDto {
  return { data: { taskId } };
}

describe("KieWebhookService", () => {
  it("wakes the matching in-flight poll and reports handled: true", async () => {
    const wakeRegistry: ITaskWakeRegistry = {
      waitForWake: vi.fn(),
      wake: vi.fn(() => true),
    };
    const service = new KieWebhookService(wakeRegistry);

    const result = await service.handleCallback(fakeBody("task_1"), "corr-1");

    expect(result).toEqual({ received: true, handled: true });
    expect(wakeRegistry.wake).toHaveBeenCalledWith("task_1");
  });

  it("a duplicate callback for an already-resolved taskId is a safe, idempotent no-op — handled: false, never throws", async () => {
    const wakeRegistry: ITaskWakeRegistry = {
      waitForWake: vi.fn(),
      wake: vi.fn(() => false),
    };
    const service = new KieWebhookService(wakeRegistry);

    const first = await service.handleCallback(fakeBody("task_1"), "corr-1");
    const second = await service.handleCallback(fakeBody("task_1"), "corr-2");

    expect(first).toEqual({ received: true, handled: false });
    expect(second).toEqual({ received: true, handled: false });
    expect(wakeRegistry.wake).toHaveBeenCalledTimes(2);
  });

  it("an unknown taskId is honestly handled as handled: false — never crashes", async () => {
    const wakeRegistry: ITaskWakeRegistry = {
      waitForWake: vi.fn(),
      wake: vi.fn(() => false),
    };
    const service = new KieWebhookService(wakeRegistry);

    await expect(service.handleCallback(fakeBody("task_never_existed"), "corr-1")).resolves.toEqual(
      { received: true, handled: false },
    );
  });

  it("degrades honestly (handled: false, never throws) when no TaskWakeRegistry is composed on this deployment", async () => {
    const service = new KieWebhookService(undefined);

    await expect(service.handleCallback(fakeBody("task_1"), "corr-1")).resolves.toEqual({
      received: true,
      handled: false,
    });
  });
  it("wakes a durable job without trusting callback output or requiring an in-memory poll", async () => {
    const jobs = { wakeProviderTask: vi.fn().mockResolvedValue(true) };
    const service = new KieWebhookService(undefined, jobs as unknown as KaiProductionRepository);
    await expect(
      service.handleCallback(
        { data: { taskId: "durable", state: "success", resultJson: "untrusted" } },
        "corr",
      ),
    ).resolves.toEqual({ received: true, handled: true });
    expect(jobs.wakeProviderTask).toHaveBeenCalledWith("durable");
  });
});
