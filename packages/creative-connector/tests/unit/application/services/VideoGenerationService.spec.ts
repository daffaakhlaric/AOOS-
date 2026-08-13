import { err, ok } from "@aos/common";
import { describe, expect, it } from "vitest";

import { VideoGenerationService } from "../../../../src/application/services/VideoGenerationService.js";
import { KieApiError } from "../../../../src/domain/errors/KieApiError.js";
import { CreativeConnectorEvents } from "../../../../src/domain/events/CreativeConnectorEvents.js";
import { AspectRatio } from "../../../../src/domain/value-objects/AspectRatio.js";
import { TaskId } from "../../../../src/domain/value-objects/TaskId.js";
import { VideoModel } from "../../../../src/domain/value-objects/VideoModel.js";
import { fakeCreativeClient } from "../../../helpers/fakeCreativeClient.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("VideoGenerationService", () => {
  it("generateFromImage builds a REFERENCE_2_VIDEO payload and returns a PENDING GenerationTask", async () => {
    let received: unknown;
    const client = fakeCreativeClient({
      generateVideoFromImage: async (payload) => {
        received = payload;
        return ok({ taskId: "task_1" });
      },
    });
    const publisher = createFakePublisher();
    const service = new VideoGenerationService(client, new CreativeConnectorEvents(publisher));
    const task = unwrap(
      await service.generateFromImage({
        sourceImageUrl: "https://cdn.kie.ai/x.jpg",
        prompt: "A car",
        model: VideoModel.VEO3_FAST,
        aspectRatio: AspectRatio.WIDESCREEN,
      }),
    );
    expect(task.kind).toBe("video");
    expect(task.taskId.toString()).toBe("task_1");
    expect((received as { generationType: string }).generationType).toBe("REFERENCE_2_VIDEO");
    expect((received as { imageUrls: string[] }).imageUrls).toEqual(["https://cdn.kie.ai/x.jpg"]);
    expect(publisher.published[0]?.type).toBe("aaos.creative-connector.video.generation-started");
  });

  it("generateFromText builds a TEXT_2_VIDEO payload", async () => {
    let received: unknown;
    const client = fakeCreativeClient({
      generateVideoFromText: async (payload) => {
        received = payload;
        return ok({ taskId: "task_2" });
      },
    });
    const service = new VideoGenerationService(
      client,
      new CreativeConnectorEvents(createFakePublisher()),
    );
    const task = unwrap(
      await service.generateFromText({
        prompt: "Showroom",
        model: VideoModel.VEO3,
        aspectRatio: AspectRatio.SQUARE,
      }),
    );
    expect(task.taskId.toString()).toBe("task_2");
    expect((received as { generationType: string }).generationType).toBe("TEXT_2_VIDEO");
  });

  it("extendVideo validates additionalSeconds via ExtendDurationSeconds and forwards it as duration", async () => {
    let received: unknown;
    const client = fakeCreativeClient({
      extendVideo: async (payload) => {
        received = payload;
        return ok({ taskId: "task_3" });
      },
    });
    const service = new VideoGenerationService(
      client,
      new CreativeConnectorEvents(createFakePublisher()),
    );
    const task = unwrap(
      await service.extendVideo({ taskId: unwrap(TaskId.create("task_1")), additionalSeconds: 7 }),
    );
    expect(task.taskId.toString()).toBe("task_3");
    expect((received as { duration: number }).duration).toBe(7);
    expect((received as { taskId: string }).taskId).toBe("task_1");
  });

  it("extendVideo rejects an out-of-range additionalSeconds without calling the client", async () => {
    const client = fakeCreativeClient();
    const service = new VideoGenerationService(
      client,
      new CreativeConnectorEvents(createFakePublisher()),
    );
    const error = unwrapErr(
      await service.extendVideo({ taskId: unwrap(TaskId.create("task_1")), additionalSeconds: 9 }),
    );
    expect(error.message).toMatch(/integer from 1 to 8/);
  });

  it("propagates a client error without publishing an event", async () => {
    const client = fakeCreativeClient({
      generateVideoFromText: async () => err(new KieApiError("boom")),
    });
    const publisher = createFakePublisher();
    const service = new VideoGenerationService(client, new CreativeConnectorEvents(publisher));
    const error = unwrapErr(
      await service.generateFromText({
        prompt: "x",
        model: VideoModel.VEO3_FAST,
        aspectRatio: AspectRatio.WIDESCREEN,
      }),
    );
    expect(error.message).toBe("boom");
    expect(publisher.published).toHaveLength(0);
  });

  it("wraps an invalid taskId in the response as a KieApiError", async () => {
    const client = fakeCreativeClient({
      generateVideoFromText: async () => ok({ taskId: "" }),
    });
    const service = new VideoGenerationService(
      client,
      new CreativeConnectorEvents(createFakePublisher()),
    );
    const error = unwrapErr(
      await service.generateFromText({
        prompt: "x",
        model: VideoModel.VEO3_FAST,
        aspectRatio: AspectRatio.WIDESCREEN,
      }),
    );
    expect(error.constructor.name).toBe("KieApiError");
  });

  it("uses the provided default callback URL when none is passed per-call", async () => {
    let received: unknown;
    const client = fakeCreativeClient({
      generateVideoFromText: async (payload) => {
        received = payload;
        return ok({ taskId: "task_1" });
      },
    });
    const service = new VideoGenerationService(
      client,
      new CreativeConnectorEvents(createFakePublisher()),
      undefined,
      "https://example.com/callback",
    );
    await service.generateFromText({
      prompt: "x",
      model: VideoModel.VEO3_FAST,
      aspectRatio: AspectRatio.WIDESCREEN,
    });
    expect((received as { callBackUrl?: string }).callBackUrl).toBe("https://example.com/callback");
  });
});
