import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { TaskPollingService } from "../../src/application/services/TaskPollingService.js";
import { VideoGenerationService } from "../../src/application/services/VideoGenerationService.js";
import { GenerateVideoFromText } from "../../src/application/use-cases/GenerateVideoFromText.js";
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
const statusHandler = (taskId: string, response: () => Response) =>
  http.get("https://api.kie.ai/api/v1/veo/record-info", ({ request }) =>
    new URL(request.url).searchParams.get("taskId") === taskId ? response() : undefined,
  );

function makeUseCase(publisher = createFakePublisher()) {
  const client = new KieAiGenerationClient({ apiKey: "key", sleep: async () => undefined });
  const events = new CreativeConnectorEvents(publisher);
  const videoService = new VideoGenerationService(client, events);
  const poller = new TaskPoller(client, { sleep: async () => undefined });
  const pollingService = new TaskPollingService(poller);
  return { useCase: new GenerateVideoFromText(videoService, pollingService, events), publisher };
}

describe("GenerateVideoFromText (integration, MSW-mocked api.kie.ai)", () => {
  it("text prompt only -> taskId -> videoUrl", async () => {
    mswServer.use(
      http.post(GENERATE_URL, () =>
        HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_veo_txt" } }),
      ),
      statusHandler("task_veo_txt", () =>
        HttpResponse.json({
          code: 200,
          data: { taskId: "task_veo_txt", successFlag: 1, videoUrl: "https://cdn.kie.ai/txt.mp4" },
        }),
      ),
    );
    const { useCase } = makeUseCase();
    const video = unwrap(
      await useCase.execute({
        prompt: "Modern used car showroom interior",
        model: VideoModel.VEO3_FAST,
        aspectRatio: AspectRatio.WIDESCREEN,
      }),
    );
    expect(video.videoUrl.toString()).toBe("https://cdn.kie.ai/txt.mp4");
  });

  it("generationType = TEXT_2_VIDEO in the request body", async () => {
    let receivedBody: unknown;
    mswServer.use(
      http.post(GENERATE_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_veo_txt2" } });
      }),
      statusHandler("task_veo_txt2", () =>
        HttpResponse.json({
          code: 200,
          data: {
            taskId: "task_veo_txt2",
            successFlag: 1,
            videoUrl: "https://cdn.kie.ai/txt2.mp4",
          },
        }),
      ),
    );
    const { useCase } = makeUseCase();
    await useCase.execute({
      prompt: "Showroom",
      model: VideoModel.VEO3_FAST,
      aspectRatio: AspectRatio.WIDESCREEN,
    });
    expect((receivedBody as { generationType: string }).generationType).toBe("TEXT_2_VIDEO");
    expect("imageUrls" in (receivedBody as object)).toBe(false);
  });

  it("successFlag=2 -> GenerationFailedError and VideoGenerationFailed event emitted", async () => {
    mswServer.use(
      http.post(GENERATE_URL, () =>
        HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_veo_txt3" } }),
      ),
      statusHandler("task_veo_txt3", () =>
        HttpResponse.json({ code: 200, data: { taskId: "task_veo_txt3", successFlag: 2 } }),
      ),
    );
    const { useCase, publisher } = makeUseCase();
    const error = unwrapErr(
      await useCase.execute({
        prompt: "x",
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
        prompt: "x",
        model: VideoModel.VEO3_FAST,
        aspectRatio: AspectRatio.WIDESCREEN,
      }),
    );
    expect(error.constructor.name).toBe("KieApiError");
  });

  it("defaults `now` to the real wall clock when not injected", async () => {
    mswServer.use(
      http.post(GENERATE_URL, () =>
        HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_veo_txt4" } }),
      ),
      statusHandler("task_veo_txt4", () =>
        HttpResponse.json({
          code: 200,
          data: {
            taskId: "task_veo_txt4",
            successFlag: 1,
            videoUrl: "https://cdn.kie.ai/txt4.mp4",
          },
        }),
      ),
    );
    const client = new KieAiGenerationClient({ apiKey: "key", sleep: async () => undefined });
    const events = new CreativeConnectorEvents(createFakePublisher());
    const videoService = new VideoGenerationService(client, events);
    const poller = new TaskPoller(client, { sleep: async () => undefined });
    const pollingService = new TaskPollingService(poller);
    const useCase = new GenerateVideoFromText(videoService, pollingService, events);
    const video = unwrap(
      await useCase.execute({
        prompt: "x",
        model: VideoModel.VEO3_FAST,
        aspectRatio: AspectRatio.WIDESCREEN,
      }),
    );
    expect(video.videoUrl.toString()).toBe("https://cdn.kie.ai/txt4.mp4");
  });
});
