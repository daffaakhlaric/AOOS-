import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { FileUploadService } from "../../src/application/services/FileUploadService.js";
import { UploadSourceImage } from "../../src/application/use-cases/UploadSourceImage.js";
import { CreativeConnectorEvents } from "../../src/domain/events/CreativeConnectorEvents.js";
import { KieAiFileUploadClient } from "../../src/infrastructure/kie-api/KieAiFileUploadClient.js";
import { mswServer } from "../helpers/msw.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { unwrap, unwrapErr } from "../helpers/result.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const UPLOAD_URL = "https://kieai.redpandaai.co/api/file-stream-upload";

function makeUseCase(publisher = createFakePublisher()) {
  const client = new KieAiFileUploadClient({ apiKey: "key" });
  const events = new CreativeConnectorEvents(publisher);
  const service = new FileUploadService(client, events);
  return { useCase: new UploadSourceImage(service), publisher };
}

describe("UploadSourceImage (integration, MSW-mocked kieai.redpandaai.co)", () => {
  it("Buffer + fileName -> fileUrl", async () => {
    mswServer.use(
      http.post(UPLOAD_URL, () =>
        HttpResponse.json({
          success: true,
          code: 200,
          msg: "File upload successful",
          data: {
            fileId: "file_abc1234",
            fileUrl: "https://cdn.kie.ai/images/aaos-dss/xpander-bintaro-001.jpg",
          },
        }),
      ),
    );
    const { useCase } = makeUseCase();
    const file = unwrap(
      await useCase.execute(Buffer.from("bytes"), "xpander-bintaro-001.jpg", "image/jpeg"),
    );
    expect(file.fileUrl.toString()).toBe(
      "https://cdn.kie.ai/images/aaos-dss/xpander-bintaro-001.jpg",
    );
  });

  it("FileUploaded event emitted", async () => {
    mswServer.use(
      http.post(UPLOAD_URL, () =>
        HttpResponse.json({
          success: true,
          code: 200,
          msg: "ok",
          data: { fileId: "file_1", fileUrl: "https://cdn.kie.ai/a.jpg" },
        }),
      ),
    );
    const { useCase, publisher } = makeUseCase();
    await useCase.execute(Buffer.from("x"), "a.jpg", "image/jpeg");
    expect(
      publisher.published.some((p) => p.type === "aaos.creative-connector.file.uploaded"),
    ).toBe(true);
  });

  it("upload failure -> FileUploadError", async () => {
    mswServer.use(http.post(UPLOAD_URL, () => new HttpResponse(null, { status: 500 })));
    const { useCase, publisher } = makeUseCase();
    const error = unwrapErr(await useCase.execute(Buffer.from("x"), "a.jpg", "image/jpeg"));
    expect(error.constructor.name).toBe("FileUploadError");
    expect(publisher.published).toHaveLength(0);
  });
});
