import { err, ok, type Result } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import type {
  ICreativeClient,
  KieTaskCreatedResponse,
  NanoBananaProGeneratePayload,
  RawTaskStatusResponse,
  VeoExtendPayload,
  VeoGenerateFromImagePayload,
  VeoGenerateFromTextPayload,
} from "../../../src/contracts/ICreativeClient.js";
import { KieApiError } from "../../../src/domain/errors/KieApiError.js";
import { TaskId } from "../../../src/domain/value-objects/TaskId.js";
import { BACKOFF_SCHEDULE_MS, TaskPoller } from "../../../src/infrastructure/polling/TaskPoller.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function fakeClient(getTaskStatus: ICreativeClient["getTaskStatus"]): ICreativeClient {
  const notImplemented = (): never => {
    throw new Error("not implemented in this fake");
  };
  return {
    generateVideoFromImage: notImplemented as (
      p: VeoGenerateFromImagePayload,
    ) => Promise<Result<KieTaskCreatedResponse, KieApiError>>,
    generateVideoFromText: notImplemented as (
      p: VeoGenerateFromTextPayload,
    ) => Promise<Result<KieTaskCreatedResponse, KieApiError>>,
    extendVideo: notImplemented as (
      p: VeoExtendPayload,
    ) => Promise<Result<KieTaskCreatedResponse, KieApiError>>,
    generateImage: notImplemented as (
      p: NanoBananaProGeneratePayload,
    ) => Promise<Result<KieTaskCreatedResponse, KieApiError>>,
    getTaskStatus,
  };
}

function taskId(): TaskId {
  return unwrap(TaskId.create("task_1"));
}

describe("TaskPoller", () => {
  it("successFlag=0 -> keeps polling until a terminal flag is observed", async () => {
    let callCount = 0;
    const client = fakeClient(async () => {
      callCount += 1;
      if (callCount < 3) {
        return ok({ taskId: "task_1", successFlag: 0 });
      }
      return ok({ taskId: "task_1", successFlag: 1, videoUrl: "https://cdn.kie.ai/v.mp4" });
    });
    const sleep = vi.fn(async () => undefined);
    const poller = new TaskPoller(client, { sleep });
    const result = unwrap(await poller.pollUntilComplete(taskId(), "video"));
    expect(callCount).toBe(3);
    expect(result.kind).toBe("video");
    if (result.kind === "video") {
      expect(result.videoUrl.toString()).toBe("https://cdn.kie.ai/v.mp4");
    }
  });

  it("successFlag=1 -> returns the videoUrl for a video task", async () => {
    const client = fakeClient(async () =>
      ok({ taskId: "task_1", successFlag: 1, videoUrl: "https://cdn.kie.ai/v.mp4" }),
    );
    const poller = new TaskPoller(client, { sleep: async () => undefined });
    const result = unwrap(await poller.pollUntilComplete(taskId(), "video"));
    expect(result.kind).toBe("video");
  });

  it("successFlag=1 -> returns the imageUrl and images for an image task", async () => {
    const client = fakeClient(async () =>
      ok({
        taskId: "task_1",
        successFlag: 1,
        imageUrl: "https://cdn.kie.ai/i1.jpg",
        images: ["https://cdn.kie.ai/i1.jpg", "https://cdn.kie.ai/i2.jpg"],
      }),
    );
    const poller = new TaskPoller(client, { sleep: async () => undefined });
    const result = unwrap(await poller.pollUntilComplete(taskId(), "image"));
    expect(result.kind).toBe("image");
    if (result.kind === "image") {
      expect(result.images).toHaveLength(2);
    }
  });

  it("defaults `images` to [imageUrl] when Kie AI omits the images array", async () => {
    const client = fakeClient(async () =>
      ok({ taskId: "task_1", successFlag: 1, imageUrl: "https://cdn.kie.ai/i1.jpg" }),
    );
    const poller = new TaskPoller(client, { sleep: async () => undefined });
    const result = unwrap(await poller.pollUntilComplete(taskId(), "image"));
    if (result.kind === "image") {
      expect(result.images).toEqual([result.imageUrl]);
    }
  });

  it("successFlag=2 -> GenerationFailedError", async () => {
    const client = fakeClient(async () => ok({ taskId: "task_1", successFlag: 2 }));
    const poller = new TaskPoller(client, { sleep: async () => undefined });
    const error = unwrapErr(await poller.pollUntilComplete(taskId(), "video"));
    expect(error.constructor.name).toBe("GenerationFailedError");
  });

  it("successFlag=3 -> GenerationFailedError (design resolution #4, same error type as flag 2)", async () => {
    const client = fakeClient(async () => ok({ taskId: "task_1", successFlag: 3 }));
    const poller = new TaskPoller(client, { sleep: async () => undefined });
    const error = unwrapErr(await poller.pollUntilComplete(taskId(), "video"));
    expect(error.constructor.name).toBe("GenerationFailedError");
  });

  it("times out after the configured timeoutMs without a terminal flag", async () => {
    const client = fakeClient(async () => ok({ taskId: "task_1", successFlag: 0 }));
    let now = 0;
    const poller = new TaskPoller(client, {
      sleep: async () => {
        now += 100_000;
      },
      now: () => new Date(now),
    });
    const error = unwrapErr(await poller.pollUntilComplete(taskId(), "video", 250_000));
    expect(error.constructor.name).toBe("TaskTimeoutError");
  });

  it("uses the backoff schedule 5s -> 10s -> 15s -> 20s -> 30s, holding at 30s thereafter", async () => {
    let callCount = 0;
    const client = fakeClient(async () => {
      callCount += 1;
      if (callCount <= 6) {
        return ok({ taskId: "task_1", successFlag: 0 });
      }
      return ok({ taskId: "task_1", successFlag: 1, videoUrl: "https://cdn.kie.ai/v.mp4" });
    });
    const sleep = vi.fn(async (_ms: number) => undefined);
    const poller = new TaskPoller(client, { sleep });
    await poller.pollUntilComplete(taskId(), "video");
    expect(sleep.mock.calls.map((call) => call[0])).toEqual([
      ...BACKOFF_SCHEDULE_MS,
      BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1],
    ]);
  });

  it("propagates a getTaskStatus error", async () => {
    const client = fakeClient(async () => err(new KieApiError("boom")));
    const poller = new TaskPoller(client, { sleep: async () => undefined });
    const error = unwrapErr(await poller.pollUntilComplete(taskId(), "video"));
    expect(error.message).toBe("boom");
  });

  it("returns a KieApiError for an unrecognized successFlag", async () => {
    const client = fakeClient(async () =>
      ok({ taskId: "task_1", successFlag: 99 } as unknown as RawTaskStatusResponse),
    );
    const poller = new TaskPoller(client, { sleep: async () => undefined });
    const error = unwrapErr(await poller.pollUntilComplete(taskId(), "video"));
    expect(error.constructor.name).toBe("KieApiError");
  });

  it("returns a KieApiError when a video success response has no videoUrl", async () => {
    const client = fakeClient(async () => ok({ taskId: "task_1", successFlag: 1 }));
    const poller = new TaskPoller(client, { sleep: async () => undefined });
    const error = unwrapErr(await poller.pollUntilComplete(taskId(), "video"));
    expect(error.message).toMatch(/no videoUrl/);
  });

  it("returns a KieApiError when an image success response has no imageUrl", async () => {
    const client = fakeClient(async () => ok({ taskId: "task_1", successFlag: 1 }));
    const poller = new TaskPoller(client, { sleep: async () => undefined });
    const error = unwrapErr(await poller.pollUntilComplete(taskId(), "image"));
    expect(error.message).toMatch(/no imageUrl/);
  });

  it("returns a KieApiError when the videoUrl is malformed", async () => {
    const client = fakeClient(async () =>
      ok({ taskId: "task_1", successFlag: 1, videoUrl: "not-a-url" }),
    );
    const poller = new TaskPoller(client, { sleep: async () => undefined });
    const error = unwrapErr(await poller.pollUntilComplete(taskId(), "video"));
    expect(error.message).toMatch(/absolute http\(s\) URL/);
  });

  it("returns a KieApiError when the imageUrl itself is malformed", async () => {
    const client = fakeClient(async () =>
      ok({ taskId: "task_1", successFlag: 1, imageUrl: "not-a-url" }),
    );
    const poller = new TaskPoller(client, { sleep: async () => undefined });
    const error = unwrapErr(await poller.pollUntilComplete(taskId(), "image"));
    expect(error.message).toMatch(/absolute http\(s\) URL/);
  });

  it("returns a KieApiError when one of the images URLs is malformed", async () => {
    const client = fakeClient(async () =>
      ok({
        taskId: "task_1",
        successFlag: 1,
        imageUrl: "https://cdn.kie.ai/i1.jpg",
        images: ["https://cdn.kie.ai/i1.jpg", "not-a-url"],
      }),
    );
    const poller = new TaskPoller(client, { sleep: async () => undefined });
    const error = unwrapErr(await poller.pollUntilComplete(taskId(), "image"));
    expect(error.message).toMatch(/absolute http\(s\) URL/);
  });

  it("uses defaultTimeoutMs when pollUntilComplete is called without an explicit timeoutMs", async () => {
    const client = fakeClient(async () => ok({ taskId: "task_1", successFlag: 0 }));
    let now = 0;
    const poller = new TaskPoller(client, {
      sleep: async () => {
        now += 1_000_000;
      },
      now: () => new Date(now),
      defaultTimeoutMs: 1000,
    });
    const error = unwrapErr(await poller.pollUntilComplete(taskId(), "video"));
    expect(error.constructor.name).toBe("TaskTimeoutError");
  });

  it("defaults sleep/now to real implementations when not injected", async () => {
    const client = fakeClient(async () =>
      ok({ taskId: "task_1", successFlag: 1, videoUrl: "https://cdn.kie.ai/v.mp4" }),
    );
    const poller = new TaskPoller(client);
    const result = unwrap(await poller.pollUntilComplete(taskId(), "video"));
    expect(result.kind).toBe("video");
  });

  it("the default (real setTimeout-based) sleep actually waits between poll attempts", async () => {
    vi.useFakeTimers();
    try {
      let callCount = 0;
      const client = fakeClient(async () => {
        callCount += 1;
        if (callCount < 2) {
          return ok({ taskId: "task_1", successFlag: 0 });
        }
        return ok({ taskId: "task_1", successFlag: 1, videoUrl: "https://cdn.kie.ai/v.mp4" });
      });
      const poller = new TaskPoller(client);
      const pending = poller.pollUntilComplete(taskId(), "video");
      await vi.advanceTimersByTimeAsync(5_000);
      const result = unwrap(await pending);
      expect(result.kind).toBe("video");
      expect(callCount).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
