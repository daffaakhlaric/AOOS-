import { describe, expect, it } from "vitest";

import { CreativeConnectorEvents } from "../../../../src/domain/events/CreativeConnectorEvents.js";
import { createFakePublisher } from "../../../helpers/publisher.js";

const OCCURRED_AT = new Date("2026-01-01T00:00:00Z");

describe("CreativeConnectorEvents", () => {
  it("publishes FileUploaded with the correct type and envelope version", async () => {
    const publisher = createFakePublisher();
    const events = new CreativeConnectorEvents(publisher);
    await events.publishFileUploaded(
      {
        fileId: "file_1",
        fileUrl: "https://cdn.kie.ai/x.jpg",
        fileName: "x.jpg",
        occurredAt: OCCURRED_AT,
        version: "1.0",
      },
      "corr-1",
    );
    expect(publisher.published[0]?.type).toBe("aaos.creative-connector.file.uploaded");
    expect(publisher.published[0]?.version).toBe("1.0.0");
    expect(publisher.published[0]?.correlationId).toBe("corr-1");
    expect(publisher.published[0]?.producer).toBe("@aos/creative-connector");
  });

  it("publishes VideoGenerationStarted", async () => {
    const publisher = createFakePublisher();
    const events = new CreativeConnectorEvents(publisher);
    await events.publishVideoGenerationStarted({
      taskId: "task_1",
      generationType: "REFERENCE_2_VIDEO",
      model: "veo3_fast",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.creative-connector.video.generation-started");
  });

  it("publishes VideoGenerationCompleted", async () => {
    const publisher = createFakePublisher();
    const events = new CreativeConnectorEvents(publisher);
    await events.publishVideoGenerationCompleted({
      taskId: "task_1",
      videoUrl: "https://cdn.kie.ai/v.mp4",
      model: "veo3_fast",
      aspectRatio: "16:9",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.creative-connector.video.generation-completed");
  });

  it("publishes VideoGenerationFailed", async () => {
    const publisher = createFakePublisher();
    const events = new CreativeConnectorEvents(publisher);
    await events.publishVideoGenerationFailed({
      taskId: "task_1",
      reason: "timed out",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.creative-connector.video.generation-failed");
  });

  it("publishes ImageGenerationStarted", async () => {
    const publisher = createFakePublisher();
    const events = new CreativeConnectorEvents(publisher);
    await events.publishImageGenerationStarted({
      taskId: "task_1",
      model: "google/nano-banana-pro",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.creative-connector.image.generation-started");
  });

  it("publishes ImageGenerationCompleted", async () => {
    const publisher = createFakePublisher();
    const events = new CreativeConnectorEvents(publisher);
    await events.publishImageGenerationCompleted({
      taskId: "task_1",
      imageUrl: "https://cdn.kie.ai/i.jpg",
      model: "google/nano-banana-pro",
      aspectRatio: "1:1",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.creative-connector.image.generation-completed");
  });

  it("publishes ImageGenerationFailed", async () => {
    const publisher = createFakePublisher();
    const events = new CreativeConnectorEvents(publisher);
    await events.publishImageGenerationFailed({
      taskId: "task_1",
      reason: "failed",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.creative-connector.image.generation-failed");
  });

  it("generates a correlationId when none is supplied", async () => {
    const publisher = createFakePublisher();
    const events = new CreativeConnectorEvents(publisher);
    await events.publishFileUploaded({
      fileId: "file_1",
      fileUrl: "https://cdn.kie.ai/x.jpg",
      fileName: "x.jpg",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.correlationId).toBeDefined();
  });
});
