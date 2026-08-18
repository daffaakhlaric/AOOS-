import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { TaskPollingService } from "../../src/application/services/TaskPollingService.js";
import { VideoGenerationService } from "../../src/application/services/VideoGenerationService.js";
import { GenerateLongVideo } from "../../src/application/use-cases/GenerateLongVideo.js";
import { CreativeConnectorEvents } from "../../src/domain/events/CreativeConnectorEvents.js";
import { AspectRatio } from "../../src/domain/value-objects/AspectRatio.js";
import { KieAiGenerationClient } from "../../src/infrastructure/kie-api/KieAiGenerationClient.js";
import { TaskPoller } from "../../src/infrastructure/polling/TaskPoller.js";
import { mswServer } from "../helpers/msw.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { unwrap } from "../helpers/result.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const GENERATE_URL = "https://api.kie.ai/api/v1/veo/generate";
const EXTEND_URL = "https://api.kie.ai/api/v1/veo/extend";
const statusUrl = (taskId: string): string => `https://api.kie.ai/api/v1/jobs/${taskId}`;

function makeUseCase(publisher = createFakePublisher()) {
  const client = new KieAiGenerationClient({ apiKey: "key", sleep: async () => undefined });
  const events = new CreativeConnectorEvents(publisher);
  const videoService = new VideoGenerationService(client, events);
  const poller = new TaskPoller(client, { sleep: async () => undefined });
  const pollingService = new TaskPollingService(poller);
  return { useCase: new GenerateLongVideo(videoService, pollingService, events), publisher };
}

/** Registers a chain of tasks task_1..task_N, each immediately successful when polled, and wires
 * /veo/generate -> task_1, /veo/extend -> the next task in the chain (by call order). Returns
 * counters so tests can assert exact call counts (the spec's pinned "N calls total"). */
function registerHandlers(taskCount: number): { generateCalls: number; extendCalls: number } {
  const counters = { generateCalls: 0, extendCalls: 0 };
  let nextTaskIndex = 1;

  mswServer.use(
    http.post(GENERATE_URL, () => {
      counters.generateCalls += 1;
      return HttpResponse.json({
        code: 200,
        msg: "success",
        data: { taskId: `task_${nextTaskIndex}` },
      });
    }),
    http.post(EXTEND_URL, () => {
      counters.extendCalls += 1;
      nextTaskIndex += 1;
      return HttpResponse.json({
        code: 200,
        msg: "success",
        data: { taskId: `task_${nextTaskIndex}` },
      });
    }),
    ...Array.from({ length: taskCount }, (_, i) => i + 1).map((n) =>
      http.get(statusUrl(`task_${n}`), () =>
        HttpResponse.json({
          code: 200,
          data: { taskId: `task_${n}`, successFlag: 1, videoUrl: `https://cdn.kie.ai/v${n}.mp4` },
        }),
      ),
    ),
  );

  return counters;
}

describe("GenerateLongVideo (integration, MSW-mocked api.kie.ai) — pinned long-video arithmetic", () => {
  it("targetDuration=15: generate(8) + extend(7) = 2 total calls", async () => {
    const counters = registerHandlers(2);
    const { useCase } = makeUseCase();
    const video = unwrap(
      await useCase.execute({
        sourceImageUrls: ["https://cdn.kie.ai/x.jpg"],
        prompt: "car",
        targetDurationSeconds: 15,
        aspectRatio: AspectRatio.WIDESCREEN,
      }),
    );
    expect(counters.generateCalls).toBe(1);
    expect(counters.extendCalls).toBe(1);
    expect(counters.generateCalls + counters.extendCalls).toBe(2);
    expect(video.videoUrl.toString()).toBe("https://cdn.kie.ai/v2.mp4");
    expect(video.totalDurationSeconds).toBe(15);
  });

  it("targetDuration=30: generate(8) + extend(8) + extend(8) + extend(6) = 4 total calls", async () => {
    const counters = registerHandlers(4);
    const { useCase } = makeUseCase();
    const video = unwrap(
      await useCase.execute({
        sourceImageUrls: ["https://cdn.kie.ai/x.jpg"],
        prompt: "car",
        targetDurationSeconds: 30,
        aspectRatio: AspectRatio.WIDESCREEN,
      }),
    );
    expect(counters.generateCalls).toBe(1);
    expect(counters.extendCalls).toBe(3);
    expect(counters.generateCalls + counters.extendCalls).toBe(4);
    expect(video.videoUrl.toString()).toBe("https://cdn.kie.ai/v4.mp4");
    expect(video.totalDurationSeconds).toBe(30);
  });

  it("the final videoUrl is from the last extend task, not the first generate task", async () => {
    registerHandlers(2);
    const { useCase } = makeUseCase();
    const video = unwrap(
      await useCase.execute({
        sourceImageUrls: ["https://cdn.kie.ai/x.jpg"],
        prompt: "car",
        targetDurationSeconds: 15,
        aspectRatio: AspectRatio.WIDESCREEN,
      }),
    );
    expect(video.videoUrl.toString()).not.toBe("https://cdn.kie.ai/v1.mp4");
  });

  it("targetDuration<=8 requires only the initial generate call (0 extends)", async () => {
    const counters = registerHandlers(1);
    const { useCase } = makeUseCase();
    const video = unwrap(
      await useCase.execute({
        sourceImageUrls: ["https://cdn.kie.ai/x.jpg"],
        prompt: "car",
        targetDurationSeconds: 8,
        aspectRatio: AspectRatio.WIDESCREEN,
      }),
    );
    expect(counters.generateCalls).toBe(1);
    expect(counters.extendCalls).toBe(0);
    expect(video.videoUrl.toString()).toBe("https://cdn.kie.ai/v1.mp4");
  });

  it("falls back to text-to-video when no sourceImageUrl is given", async () => {
    let receivedBody: unknown;
    mswServer.use(
      http.post(GENERATE_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_1" } });
      }),
      http.get(statusUrl("task_1"), () =>
        HttpResponse.json({
          code: 200,
          data: { taskId: "task_1", successFlag: 1, videoUrl: "https://cdn.kie.ai/v1.mp4" },
        }),
      ),
    );
    const { useCase } = makeUseCase();
    await useCase.execute({
      prompt: "Showroom",
      targetDurationSeconds: 8,
      aspectRatio: AspectRatio.WIDESCREEN,
    });
    expect((receivedBody as { generationType: string }).generationType).toBe("TEXT_2_VIDEO");
  });

  it("VideoGenerationCompleted is published exactly once, after the whole chain completes", async () => {
    registerHandlers(2);
    const { useCase, publisher } = makeUseCase();
    await useCase.execute({
      sourceImageUrls: ["https://cdn.kie.ai/x.jpg"],
      prompt: "car",
      targetDurationSeconds: 15,
      aspectRatio: AspectRatio.WIDESCREEN,
    });
    const completedEvents = publisher.published.filter(
      (p) => p.type === "aaos.creative-connector.video.generation-completed",
    );
    expect(completedEvents).toHaveLength(1);
  });

  it("propagates a poll failure that occurs right after the initial generate call", async () => {
    mswServer.use(
      http.post(GENERATE_URL, () =>
        HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_1" } }),
      ),
      http.get(statusUrl("task_1"), () =>
        HttpResponse.json({ code: 200, data: { taskId: "task_1", successFlag: 2 } }),
      ),
    );
    const { useCase, publisher } = makeUseCase();
    const result = await useCase.execute({
      sourceImageUrls: ["https://cdn.kie.ai/x.jpg"],
      prompt: "car",
      targetDurationSeconds: 15,
      aspectRatio: AspectRatio.WIDESCREEN,
    });
    expect(result.ok).toBe(false);
    expect(
      publisher.published.some((p) => p.type === "aaos.creative-connector.video.generation-failed"),
    ).toBe(true);
  });

  it("propagates a poll failure that occurs after a mid-chain extend call", async () => {
    mswServer.use(
      http.post(GENERATE_URL, () =>
        HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_1" } }),
      ),
      http.get(statusUrl("task_1"), () =>
        HttpResponse.json({
          code: 200,
          data: { taskId: "task_1", successFlag: 1, videoUrl: "https://cdn.kie.ai/v1.mp4" },
        }),
      ),
      http.post(EXTEND_URL, () =>
        HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_2" } }),
      ),
      http.get(statusUrl("task_2"), () =>
        HttpResponse.json({ code: 200, data: { taskId: "task_2", successFlag: 2 } }),
      ),
    );
    const { useCase, publisher } = makeUseCase();
    const result = await useCase.execute({
      sourceImageUrls: ["https://cdn.kie.ai/x.jpg"],
      prompt: "car",
      targetDurationSeconds: 15,
      aspectRatio: AspectRatio.WIDESCREEN,
    });
    expect(result.ok).toBe(false);
    expect(
      publisher.published.some((p) => p.type === "aaos.creative-connector.video.generation-failed"),
    ).toBe(true);
  });

  it("propagates a failure from the initial generate call", async () => {
    mswServer.use(http.post(GENERATE_URL, () => new HttpResponse(null, { status: 500 })));
    const { useCase } = makeUseCase();
    const result = await useCase.execute({
      sourceImageUrls: ["https://cdn.kie.ai/x.jpg"],
      prompt: "car",
      targetDurationSeconds: 15,
      aspectRatio: AspectRatio.WIDESCREEN,
    });
    expect(result.ok).toBe(false);
  });

  it("propagates a failure from a mid-chain extend call, publishing VideoGenerationFailed", async () => {
    mswServer.use(
      http.post(GENERATE_URL, () =>
        HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_1" } }),
      ),
      http.get(statusUrl("task_1"), () =>
        HttpResponse.json({
          code: 200,
          data: { taskId: "task_1", successFlag: 1, videoUrl: "https://cdn.kie.ai/v1.mp4" },
        }),
      ),
      http.post(EXTEND_URL, () => new HttpResponse(null, { status: 500 })),
    );
    const { useCase, publisher } = makeUseCase();
    const result = await useCase.execute({
      sourceImageUrls: ["https://cdn.kie.ai/x.jpg"],
      prompt: "car",
      targetDurationSeconds: 15,
      aspectRatio: AspectRatio.WIDESCREEN,
    });
    expect(result.ok).toBe(false);
    expect(
      publisher.published.some((p) => p.type === "aaos.creative-connector.video.generation-failed"),
    ).toBe(true);
  });
});
