import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { TaskPollingService } from "../../src/application/services/TaskPollingService.js";
import { VideoGenerationService } from "../../src/application/services/VideoGenerationService.js";
import { GenerateVideoFromImage } from "../../src/application/use-cases/GenerateVideoFromImage.js";
import { CreativeConnectorEvents } from "../../src/domain/events/CreativeConnectorEvents.js";
import { AspectRatio } from "../../src/domain/value-objects/AspectRatio.js";
import { VideoModel } from "../../src/domain/value-objects/VideoModel.js";
import { KieAiGenerationClient } from "../../src/infrastructure/kie-api/KieAiGenerationClient.js";
import { TaskPoller } from "../../src/infrastructure/polling/TaskPoller.js";
import { mswServer } from "../helpers/msw.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { unwrap, unwrapErr } from "../helpers/result.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const GENERATE_URL = "https://api.kie.ai/api/v1/veo/generate";
const statusUrl = (taskId: string): string => `https://api.kie.ai/api/v1/jobs/${taskId}`;

function makeUseCase(publisher = createFakePublisher()) {
  const client = new KieAiGenerationClient({ apiKey: "key", sleep: async () => undefined });
  const events = new CreativeConnectorEvents(publisher);
  const videoService = new VideoGenerationService(client, events);
  const poller = new TaskPoller(client, { sleep: async () => undefined });
  const pollingService = new TaskPollingService(poller);
  return { useCase: new GenerateVideoFromImage(videoService, pollingService, events), publisher };
}

describe("GenerateVideoFromImage (integration, MSW-mocked api.kie.ai)", () => {
  it("sourceImageUrl + prompt -> taskId -> poll -> videoUrl", async () => {
    mswServer.use(
      http.post(GENERATE_URL, () =>
        HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_veo_1" } }),
      ),
      http.get(statusUrl("task_veo_1"), () =>
        HttpResponse.json({
          code: 200,
          data: { taskId: "task_veo_1", successFlag: 1, videoUrl: "https://cdn.kie.ai/v.mp4" },
        }),
      ),
    );
    const { useCase } = makeUseCase();
    const video = unwrap(
      await useCase.execute({
        sourceImageUrl: "https://cdn.kie.ai/x.jpg",
        prompt: "White Mitsubishi Xpander SUV",
        model: VideoModel.VEO3_FAST,
        aspectRatio: AspectRatio.WIDESCREEN,
      }),
    );
    expect(video.videoUrl.toString()).toBe("https://cdn.kie.ai/v.mp4");
  });

  it("successFlag=1 -> videoUrl and VideoGenerationCompleted event emitted", async () => {
    mswServer.use(
      http.post(GENERATE_URL, () =>
        HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_veo_2" } }),
      ),
      http.get(statusUrl("task_veo_2"), () =>
        HttpResponse.json({
          code: 200,
          data: { taskId: "task_veo_2", successFlag: 1, videoUrl: "https://cdn.kie.ai/v2.mp4" },
        }),
      ),
    );
    const { useCase, publisher } = makeUseCase();
    await useCase.execute({
      sourceImageUrl: "https://cdn.kie.ai/x.jpg",
      prompt: "car",
      model: VideoModel.VEO3_FAST,
      aspectRatio: AspectRatio.WIDESCREEN,
    });
    expect(
      publisher.published.some(
        (p) => p.type === "aaos.creative-connector.video.generation-completed",
      ),
    ).toBe(true);
  });

  it("successFlag=2 -> GenerationFailedError and VideoGenerationFailed event emitted", async () => {
    mswServer.use(
      http.post(GENERATE_URL, () =>
        HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_veo_3" } }),
      ),
      http.get(statusUrl("task_veo_3"), () =>
        HttpResponse.json({ code: 200, data: { taskId: "task_veo_3", successFlag: 2 } }),
      ),
    );
    const { useCase, publisher } = makeUseCase();
    const error = unwrapErr(
      await useCase.execute({
        sourceImageUrl: "https://cdn.kie.ai/x.jpg",
        prompt: "car",
        model: VideoModel.VEO3_FAST,
        aspectRatio: AspectRatio.WIDESCREEN,
      }),
    );
    expect(error.constructor.name).toBe("GenerationFailedError");
    expect(
      publisher.published.some((p) => p.type === "aaos.creative-connector.video.generation-failed"),
    ).toBe(true);
  });

  it("propagates a generate-call failure without polling", async () => {
    mswServer.use(http.post(GENERATE_URL, () => new HttpResponse(null, { status: 500 })));
    const { useCase } = makeUseCase();
    const error = unwrapErr(
      await useCase.execute({
        sourceImageUrl: "https://cdn.kie.ai/x.jpg",
        prompt: "car",
        model: VideoModel.VEO3_FAST,
        aspectRatio: AspectRatio.WIDESCREEN,
      }),
    );
    expect(error.constructor.name).toBe("KieApiError");
  });
});
