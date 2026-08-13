import type { GetAssetsByUnit, SaveAiCreative } from "@aos/asset-library";
import type {
  DownloadMedia,
  GenerateImageSet,
  GenerateLongVideo,
  UploadSourceImage,
} from "@aos/creative-connector";
import { describe, expect, it, vi } from "vitest";

import { KaiAgentFactory } from "../../../src/factories/KaiAgentFactory.js";
import { buildBrief } from "../../fixtures/creativeBriefFixtures.js";
import {
  buildAsset,
  buildAssetCollection,
  okResult,
  RecordingPublisher,
} from "../../helpers/mocks.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function fakeConnectorBundle() {
  return {
    getAssetsByUnit: {
      execute: vi.fn().mockResolvedValue(okResult(buildAssetCollection([]))),
    } as unknown as GetAssetsByUnit,
    saveAiCreative: {
      execute: vi
        .fn()
        .mockResolvedValue(
          okResult(buildAssetCollection([buildAsset({ publicUrl: "https://cdn.test/img.jpg" })])),
        ),
    } as unknown as SaveAiCreative,
    uploadSourceImage: { execute: vi.fn() } as unknown as UploadSourceImage,
    generateLongVideo: { execute: vi.fn() } as unknown as GenerateLongVideo,
    generateImageSet: {
      execute: vi.fn().mockResolvedValue(
        okResult({
          succeeded: [
            { index: 0, image: { imageUrl: { toString: () => "https://cdn.kie.ai/x.jpg" } } },
          ],
          failed: [],
        }),
      ),
    } as unknown as GenerateImageSet,
    downloadMedia: {
      execute: vi.fn().mockResolvedValue(okResult(Buffer.from("img"))),
    } as unknown as DownloadMedia,
  };
}

describe("KaiAgentFactory", () => {
  it("create() returns a fully-wired KaiAgentRuntime for a valid config", () => {
    const bundle = fakeConnectorBundle();
    const runtime = unwrap(
      KaiAgentFactory.create({
        config: { tenantId: "dss-motor" },
        publisher: new RecordingPublisher(),
        ...bundle,
      }),
    );

    expect(runtime.agent.name).toBe("Kai");
    expect(runtime.config.tenantId).toBe("dss-motor");
    expect(runtime.processCreativeBrief).toBeDefined();
    expect(runtime.getGenerationStatus).toBeDefined();
    expect(runtime.retryFailedGeneration).toBeDefined();
  });

  it("create() fails fast with an invalid config (empty tenantId)", () => {
    const bundle = fakeConnectorBundle();
    const error = unwrapErr(
      KaiAgentFactory.create({
        config: { tenantId: "" },
        publisher: new RecordingPublisher(),
        ...bundle,
      }),
    );
    expect(error.message).toContain("CreativeAgentConfig");
  });

  it("wired processCreativeBrief use case can run end-to-end against the fake bundle", async () => {
    const bundle = fakeConnectorBundle();
    const runtime = unwrap(
      KaiAgentFactory.create({
        config: { tenantId: "dss-motor" },
        publisher: new RecordingPublisher(),
        ...bundle,
      }),
    );

    const result = await runtime.processCreativeBrief.execute(
      buildBrief({ formats: ["IMAGE_SQUARE"] }),
    );
    expect(result.ok).toBe(true);
  });

  it("GetGenerationStatus reflects jobs created via processCreativeBrief", async () => {
    const bundle = fakeConnectorBundle();
    const runtime = unwrap(
      KaiAgentFactory.create({
        config: { tenantId: "dss-motor" },
        publisher: new RecordingPublisher(),
        ...bundle,
      }),
    );

    await runtime.processCreativeBrief.execute(buildBrief({ formats: ["IMAGE_SQUARE"] }));
    expect(runtime.jobRegistry.all()).toHaveLength(1);
  });
});
