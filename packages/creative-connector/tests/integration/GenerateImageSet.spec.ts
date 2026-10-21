import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { ImageGenerationService } from "../../src/application/services/ImageGenerationService.js";
import { TaskPollingService } from "../../src/application/services/TaskPollingService.js";
import { GenerateImage } from "../../src/application/use-cases/GenerateImage.js";
import { GenerateImageSet } from "../../src/application/use-cases/GenerateImageSet.js";
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

const CREATE_TASK_URL = "https://api.kie.ai/api/v1/jobs/createTask";
const statusHandler = (taskId: string, response: () => Response) =>
  http.get("https://api.kie.ai/api/v1/jobs/recordInfo", ({ request }) =>
    new URL(request.url).searchParams.get("taskId") === taskId ? response() : undefined,
  );

function makeUseCase() {
  const client = new KieAiGenerationClient({ apiKey: "key", sleep: async () => undefined });
  const events = new CreativeConnectorEvents(createFakePublisher());
  const imageService = new ImageGenerationService(client, events);
  const poller = new TaskPoller(client, { sleep: async () => undefined });
  const pollingService = new TaskPollingService(poller);
  const generateImage = new GenerateImage(imageService, pollingService, events);
  return new GenerateImageSet(generateImage);
}

describe("GenerateImageSet (integration, MSW-mocked api.kie.ai)", () => {
  it("3 images -> 3 parallel tasks -> 3 imageUrls", async () => {
    let counter = 0;
    mswServer.use(
      http.post(CREATE_TASK_URL, () => {
        counter += 1;
        return HttpResponse.json({
          code: 200,
          msg: "success",
          data: { taskId: `task_${counter}` },
        });
      }),
      statusHandler("task_1", () =>
        HttpResponse.json({
          code: 200,
          data: { taskId: "task_1", successFlag: 1, imageUrl: "https://cdn.kie.ai/i1.jpg" },
        }),
      ),
      statusHandler("task_2", () =>
        HttpResponse.json({
          code: 200,
          data: { taskId: "task_2", successFlag: 1, imageUrl: "https://cdn.kie.ai/i2.jpg" },
        }),
      ),
      statusHandler("task_3", () =>
        HttpResponse.json({
          code: 200,
          data: { taskId: "task_3", successFlag: 1, imageUrl: "https://cdn.kie.ai/i3.jpg" },
        }),
      ),
    );
    const useCase = makeUseCase();
    const result = unwrap(
      await useCase.execute({
        requests: [
          { prompt: "prompt 1", aspectRatio: AspectRatio.SQUARE },
          { prompt: "prompt 2", aspectRatio: AspectRatio.SQUARE },
          { prompt: "prompt 3", aspectRatio: AspectRatio.SQUARE },
        ],
      }),
    );
    expect(result.succeeded).toHaveLength(3);
    expect(result.failed).toHaveLength(0);
    expect(result.succeeded.map((s) => s.image.imageUrl.toString()).sort()).toEqual(
      [
        "https://cdn.kie.ai/i1.jpg",
        "https://cdn.kie.ai/i2.jpg",
        "https://cdn.kie.ai/i3.jpg",
      ].sort(),
    );
  });

  it("partial: 2 success + 1 fail -> 2 urls + 1 error logged", async () => {
    // Branches on the request's own `prompt` (not call-order) so the outcome is deterministic
    // regardless of how `Promise.all` interleaves the 3 concurrent requests.
    mswServer.use(
      http.post(CREATE_TASK_URL, async ({ request }) => {
        const body = (await request.json()) as { input: { prompt: string } };
        if (body.input.prompt === "prompt 2") {
          return new HttpResponse(null, { status: 500 });
        }
        const taskId = body.input.prompt === "prompt 1" ? "task_1" : "task_3";
        return HttpResponse.json({ code: 200, msg: "success", data: { taskId } });
      }),
      statusHandler("task_1", () =>
        HttpResponse.json({
          code: 200,
          data: { taskId: "task_1", successFlag: 1, imageUrl: "https://cdn.kie.ai/i1.jpg" },
        }),
      ),
      statusHandler("task_3", () =>
        HttpResponse.json({
          code: 200,
          data: { taskId: "task_3", successFlag: 1, imageUrl: "https://cdn.kie.ai/i3.jpg" },
        }),
      ),
    );
    const useCase = makeUseCase();
    const result = unwrap(
      await useCase.execute({
        requests: [
          { prompt: "prompt 1", aspectRatio: AspectRatio.SQUARE },
          { prompt: "prompt 2", aspectRatio: AspectRatio.SQUARE },
          { prompt: "prompt 3", aspectRatio: AspectRatio.SQUARE },
        ],
      }),
    );
    expect(result.succeeded).toHaveLength(2);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.index).toBe(1);
  });

  it("an empty requests array returns an empty result", async () => {
    const useCase = makeUseCase();
    const result = unwrap(await useCase.execute({ requests: [] }));
    expect(result.succeeded).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });
});
