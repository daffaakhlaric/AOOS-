import { Branch } from "@aos/meta-ads-connector";
import { beforeEach, describe, expect, it } from "vitest";

import { CreativeAgentEvents } from "../../../../src/domain/events/CreativeAgentEvents.js";
import { CreativeFormat } from "../../../../src/domain/value-objects/CreativeFormat.js";
import { RecordingPublisher } from "../../../helpers/mocks.js";

describe("CreativeAgentEvents", () => {
  let publisher: RecordingPublisher;
  let events: CreativeAgentEvents;

  beforeEach(() => {
    publisher = new RecordingPublisher();
    events = new CreativeAgentEvents(publisher);
  });

  it("publishCreativeGenerationStarted() publishes with the correct type", async () => {
    await events.publishCreativeGenerationStarted({
      jobId: "job-1",
      briefId: "brief-1",
      branch: Branch.BINTARO,
      unit: "Xpander Cross 2019",
      format: CreativeFormat.VIDEO_AND_IMAGES,
      tenantId: "dss-motor",
      correlationId: "cid-1",
      occurredAt: new Date(),
      version: "1.0",
    });
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]?.type).toBe("aaos.creative.generation.started");
  });

  it("publishCreativePackageReady() publishes with the correct type", async () => {
    await events.publishCreativePackageReady({
      packageId: "pkg-1",
      briefId: "brief-1",
      branch: Branch.BINTARO,
      unit: "Xpander Cross 2019",
      imageUrls: ["https://cdn.test/1.jpg"],
      copyVariantCount: 3,
      confidenceScore: 90,
      tenantId: "dss-motor",
      correlationId: "cid-1",
      occurredAt: new Date(),
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.creative.package.ready");
  });

  it("publishCreativeGenerationFailed() publishes with the correct type", async () => {
    await events.publishCreativeGenerationFailed({
      briefId: "brief-1",
      branch: Branch.BINTARO,
      unit: "Xpander Cross 2019",
      reason: "all images failed",
      tenantId: "dss-motor",
      correlationId: "cid-1",
      occurredAt: new Date(),
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.creative.generation.failed");
  });

  it("publishCopyVariantGenerated() publishes with the correct type", async () => {
    await events.publishCopyVariantGenerated({
      briefId: "brief-1",
      variantLabel: "A",
      angle: "DP_RINGAN" as never,
      headline: "DP Ringan Xpander",
      tenantId: "dss-motor",
      correlationId: "cid-1",
      occurredAt: new Date(),
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.creative.copy-variant.generated");
  });

  it("publish calls IPublisher.publish with source/producer/version metadata", async () => {
    await events.publishCreativeGenerationFailed({
      briefId: "brief-1",
      branch: Branch.BINTARO,
      unit: "Xpander Cross 2019",
      reason: "x",
      tenantId: "dss-motor",
      correlationId: "cid-1",
      occurredAt: new Date(),
      version: "1.0",
    });
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "@aos/creative-agent",
        producer: "@aos/creative-agent",
        tenantId: "dss-motor",
        correlationId: "cid-1",
        version: "1.0.0",
      }),
    );
  });
});
