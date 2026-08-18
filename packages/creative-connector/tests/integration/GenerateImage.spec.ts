import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { ImageGenerationService } from "../../src/application/services/ImageGenerationService.js";
import { TaskPollingService } from "../../src/application/services/TaskPollingService.js";
import { GenerateImage } from "../../src/application/use-cases/GenerateImage.js";
import { CreativeConnectorEvents } from "../../src/domain/events/CreativeConnectorEvents.js";
import { AspectRatio } from "../../src/domain/value-objects/AspectRatio.js";
import { KieAiGenerationClient } from "../../src/infrastructure/kie-api/KieAiGenerationClient.js";
import { TaskPoller } from "../../src/infrastructure/polling/TaskPoller.js";
import { mswServer } from "../helpers/msw.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { unwrap, unwrapErr } from "../helpers/result.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const CREATE_TASK_URL = "https://api.kie.ai/api/v1/jobs/createTask";
const statusUrl = (taskId: string): string => `https://api.kie.ai/api/v1/jobs/${taskId}`;

function makeUseCase(publisher = createFakePublisher()) {
  const client = new KieAiGenerationClient({ apiKey: "key", sleep: async () => undefined });
  const events = new CreativeConnectorEvents(publisher);
  const imageService = new ImageGenerationService(client, events);
  const poller = new TaskPoller(client, { sleep: async () => undefined });
  const pollingService = new TaskPollingService(poller);
  return { useCase: new GenerateImage(imageService, pollingService, events), publisher };
}

describe("GenerateImage (integration, MSW-mocked api.kie.ai)", () => {
  it("sourceImageUrl + prompt -> taskId -> imageUrl", async () => {
    mswServer.use(
      http.post(CREATE_TASK_URL, () =>
        HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_google_1" } }),
      ),
      http.get(statusUrl("task_google_1"), () =>
        HttpResponse.json({
          code: 200,
          data: { taskId: "task_google_1", successFlag: 1, imageUrl: "https://cdn.kie.ai/i.jpg" },
        }),
      ),
    );
    const { useCase } = makeUseCase();
    const image = unwrap(
      await useCase.execute({
        sourceImageUrls: ["https://cdn.kie.ai/x.jpg"],
        prompt: "Professional car photography",
        aspectRatio: AspectRatio.SQUARE,
      }),
    );
    expect(image.imageUrl.toString()).toBe("https://cdn.kie.ai/i.jpg");
  });

  it("model = nano-banana-pro in the request body", async () => {
    let receivedBody: unknown;
    mswServer.use(
      http.post(CREATE_TASK_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_google_2" } });
      }),
      http.get(statusUrl("task_google_2"), () =>
        HttpResponse.json({
          code: 200,
          data: { taskId: "task_google_2", successFlag: 1, imageUrl: "https://cdn.kie.ai/i2.jpg" },
        }),
      ),
    );
    const { useCase } = makeUseCase();
    await useCase.execute({ prompt: "x", aspectRatio: AspectRatio.SQUARE });
    expect((receivedBody as { model: string }).model).toBe("nano-banana-pro");
  });

  it("ImageGenerationCompleted event emitted", async () => {
    mswServer.use(
      http.post(CREATE_TASK_URL, () =>
        HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_google_3" } }),
      ),
      http.get(statusUrl("task_google_3"), () =>
        HttpResponse.json({
          code: 200,
          data: { taskId: "task_google_3", successFlag: 1, imageUrl: "https://cdn.kie.ai/i3.jpg" },
        }),
      ),
    );
    const { useCase, publisher } = makeUseCase();
    await useCase.execute({ prompt: "x", aspectRatio: AspectRatio.SQUARE });
    expect(
      publisher.published.some(
        (p) => p.type === "aaos.creative-connector.image.generation-completed",
      ),
    ).toBe(true);
  });

  it("successFlag=3 -> GenerationFailedError and ImageGenerationFailed event emitted", async () => {
    mswServer.use(
      http.post(CREATE_TASK_URL, () =>
        HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_google_4" } }),
      ),
      http.get(statusUrl("task_google_4"), () =>
        HttpResponse.json({ code: 200, data: { taskId: "task_google_4", successFlag: 3 } }),
      ),
    );
    const { useCase, publisher } = makeUseCase();
    const error = unwrapErr(
      await useCase.execute({ prompt: "x", aspectRatio: AspectRatio.SQUARE }),
    );
    expect(error.constructor.name).toBe("GenerationFailedError");
    expect(
      publisher.published.some((p) => p.type === "aaos.creative-connector.image.generation-failed"),
    ).toBe(true);
  });
});
