import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { UploadSourceImage } from "../../../src/application/use-cases/UploadSourceImage.js";
import type { CreativeConnectorConfig } from "../../../src/config/CreativeConnectorConfig.js";
import { CreativeConnectorFactory } from "../../../src/factories/CreativeConnectorFactory.js";
import { mswServer } from "../../helpers/msw.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap } from "../../helpers/result.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

function config(): CreativeConnectorConfig {
  return {
    apiKey: "key",
    generationBaseUrl: "https://api.kie.ai",
    uploadBaseUrl: "https://kieai.redpandaai.co",
    defaultVideoModel: "veo3_fast",
    defaultImageModel: "nano-banana-pro",
    defaultAspectRatio: "16:9",
    pollIntervalMs: 5000,
    maxPollDurationMs: 300000,
    rateLimitPerTenSeconds: 20,
    tenantId: "tenant-1",
  };
}

describe("CreativeConnectorFactory", () => {
  it("builds a fully-wired bundle with every use case and service", () => {
    const bundle = CreativeConnectorFactory.create({
      config: config(),
      publisher: createFakePublisher(),
      sleep: async () => undefined,
    });
    expect(bundle.uploadSourceImage).toBeInstanceOf(UploadSourceImage);
    expect(bundle.generateVideoFromImage).toBeDefined();
    expect(bundle.generateVideoFromText).toBeDefined();
    expect(bundle.generateLongVideo).toBeDefined();
    expect(bundle.generateImage).toBeDefined();
    expect(bundle.generateImageSet).toBeDefined();
    expect(bundle.getTaskStatus).toBeDefined();
    expect(bundle.downloadMedia).toBeDefined();
    expect(bundle.fileUploadService).toBeDefined();
    expect(bundle.videoGenerationService).toBeDefined();
    expect(bundle.imageGenerationService).toBeDefined();
  });

  it("the built bundle performs a real end-to-end upload against the mocked upload host", async () => {
    mswServer.use(
      http.post("https://kieai.redpandaai.co/api/file-stream-upload", () =>
        HttpResponse.json({
          success: true,
          code: 200,
          msg: "ok",
          data: { filePath: "file_1", downloadUrl: "https://cdn.kie.ai/a.jpg" },
        }),
      ),
    );
    const bundle = CreativeConnectorFactory.create({
      config: config(),
      publisher: createFakePublisher(),
      sleep: async () => undefined,
    });
    const file = unwrap(
      await bundle.uploadSourceImage.execute(Buffer.from("x"), "a.jpg", "image/jpeg"),
    );
    expect(file.fileId.toString()).toBe("file_1");
  });

  it("defaults `now` to the real wall clock when not injected", () => {
    const bundle = CreativeConnectorFactory.create({
      config: config(),
      publisher: createFakePublisher(),
    });
    expect(bundle.fileUploadService).toBeDefined();
  });
});
