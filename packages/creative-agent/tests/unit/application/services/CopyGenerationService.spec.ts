import { ErrorCode } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import { CopyGenerationService } from "../../../../src/application/services/CopyGenerationService.js";
import { CreativeAgentError } from "../../../../src/domain/errors/CreativeAgentError.js";
import { CreativeAgentEvents } from "../../../../src/domain/events/CreativeAgentEvents.js";
import { CopyBuilder } from "../../../../src/intelligence/CopyBuilder.js";
import { buildBrief } from "../../../fixtures/creativeBriefFixtures.js";
import { errResult, RecordingPublisher } from "../../../helpers/mocks.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("CopyGenerationService", () => {
  it("generate() returns 3 CopyVariants and publishes 3 CopyVariantGenerated events", async () => {
    const publisher = new RecordingPublisher();
    const service = new CopyGenerationService(
      new CopyBuilder(),
      new CreativeAgentEvents(publisher),
    );

    const variants = unwrap(await service.generate(buildBrief(), "dss-motor", "cid-1"));

    expect(variants).toHaveLength(3);
    const copyEvents = publisher.published.filter(
      (e) => e.type === "aaos.creative.copy-variant.generated",
    );
    expect(copyEvents).toHaveLength(3);
  });

  it("published events carry the correct variantLabel per variant", async () => {
    const publisher = new RecordingPublisher();
    const service = new CopyGenerationService(
      new CopyBuilder(),
      new CreativeAgentEvents(publisher),
    );

    await service.generate(buildBrief(), "dss-motor", "cid-1");

    const labels = publisher.published
      .filter((e) => e.type === "aaos.creative.copy-variant.generated")
      .map((e) => (e.payload as { variantLabel: string }).variantLabel);
    expect(labels).toEqual(["A", "B", "C"]);
  });

  it("propagates a CopyBuilder failure without publishing any events", async () => {
    const publisher = new RecordingPublisher();
    const failingBuilder = {
      buildVariants: vi
        .fn()
        .mockReturnValue(errResult(new CreativeAgentError(ErrorCode.INTERNAL, "build failed"))),
    } as unknown as CopyBuilder;
    const service = new CopyGenerationService(failingBuilder, new CreativeAgentEvents(publisher));

    const error = unwrapErr(await service.generate(buildBrief(), "dss-motor", "cid-1"));
    expect(error.message).toBe("build failed");
    expect(publisher.published).toHaveLength(0);
  });
});
