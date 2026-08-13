import { err, ok } from "@aos/common";
import { describe, expect, it } from "vitest";

import { ImageGenerationService } from "../../../../src/application/services/ImageGenerationService.js";
import { KieApiError } from "../../../../src/domain/errors/KieApiError.js";
import { CreativeConnectorEvents } from "../../../../src/domain/events/CreativeConnectorEvents.js";
import { AspectRatio } from "../../../../src/domain/value-objects/AspectRatio.js";
import { fakeCreativeClient } from "../../../helpers/fakeCreativeClient.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("ImageGenerationService", () => {
  it("builds the Nano Banana Pro payload with a source image and returns a PENDING GenerationTask", async () => {
    let received: unknown;
    const client = fakeCreativeClient({
      generateImage: async (payload) => {
        received = payload;
        return ok({ taskId: "task_1" });
      },
    });
    const publisher = createFakePublisher();
    const service = new ImageGenerationService(client, new CreativeConnectorEvents(publisher));
    const task = unwrap(
      await service.generate({
        sourceImageUrl: "https://cdn.kie.ai/x.jpg",
        prompt: "car photo",
        aspectRatio: AspectRatio.SQUARE,
      }),
    );
    expect(task.kind).toBe("image");
    expect((received as { model: string }).model).toBe("google/nano-banana-pro");
    expect((received as { input: { image_url?: string } }).input.image_url).toBe(
      "https://cdn.kie.ai/x.jpg",
    );
    expect((received as { input: { output_format: string } }).input.output_format).toBe("jpg");
    expect(publisher.published[0]?.type).toBe("aaos.creative-connector.image.generation-started");
  });

  it("omits image_url entirely when no sourceImageUrl is given", async () => {
    let received: unknown;
    const client = fakeCreativeClient({
      generateImage: async (payload) => {
        received = payload;
        return ok({ taskId: "task_1" });
      },
    });
    const service = new ImageGenerationService(
      client,
      new CreativeConnectorEvents(createFakePublisher()),
    );
    await service.generate({ prompt: "car photo", aspectRatio: AspectRatio.SQUARE });
    expect("image_url" in (received as { input: object }).input).toBe(false);
  });

  it("respects an explicit outputFormat override", async () => {
    let received: unknown;
    const client = fakeCreativeClient({
      generateImage: async (payload) => {
        received = payload;
        return ok({ taskId: "task_1" });
      },
    });
    const service = new ImageGenerationService(
      client,
      new CreativeConnectorEvents(createFakePublisher()),
    );
    await service.generate({ prompt: "x", aspectRatio: AspectRatio.SQUARE, outputFormat: "png" });
    expect((received as { input: { output_format: string } }).input.output_format).toBe("png");
  });

  it("propagates a client error without publishing an event", async () => {
    const client = fakeCreativeClient({ generateImage: async () => err(new KieApiError("boom")) });
    const publisher = createFakePublisher();
    const service = new ImageGenerationService(client, new CreativeConnectorEvents(publisher));
    const error = unwrapErr(
      await service.generate({ prompt: "x", aspectRatio: AspectRatio.SQUARE }),
    );
    expect(error.message).toBe("boom");
    expect(publisher.published).toHaveLength(0);
  });

  it("wraps an invalid taskId in the response as a KieApiError", async () => {
    const client = fakeCreativeClient({ generateImage: async () => ok({ taskId: "" }) });
    const service = new ImageGenerationService(
      client,
      new CreativeConnectorEvents(createFakePublisher()),
    );
    const error = unwrapErr(
      await service.generate({ prompt: "x", aspectRatio: AspectRatio.SQUARE }),
    );
    expect(error.constructor.name).toBe("KieApiError");
  });
});
