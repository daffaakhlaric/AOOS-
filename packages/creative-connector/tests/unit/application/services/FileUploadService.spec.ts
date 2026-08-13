import { err, ok } from "@aos/common";
import { describe, expect, it } from "vitest";

import { FileUploadService } from "../../../../src/application/services/FileUploadService.js";
import type {
  IFileUploader,
  SupportedImageMimeType,
} from "../../../../src/contracts/IFileUploader.js";
import { UploadedFile } from "../../../../src/domain/entities/UploadedFile.js";
import { FileUploadError } from "../../../../src/domain/errors/FileUploadError.js";
import { CreativeConnectorEvents } from "../../../../src/domain/events/CreativeConnectorEvents.js";
import { FileId } from "../../../../src/domain/value-objects/FileId.js";
import { FileUrl } from "../../../../src/domain/value-objects/FileUrl.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

function successfulUploader(): IFileUploader {
  return {
    upload: async () =>
      ok(
        unwrap(
          UploadedFile.create({
            fileId: unwrap(FileId.create("file_1")),
            fileUrl: unwrap(FileUrl.create("https://cdn.kie.ai/x.jpg")),
            fileName: "x.jpg",
            uploadedAt: new Date("2026-01-01T00:00:00Z"),
          }),
        ),
      ),
  };
}

function failingUploader(): IFileUploader {
  return { upload: async () => err(new FileUploadError("upload failed")) };
}

describe("FileUploadService", () => {
  it("uploads and publishes FileUploaded on success", async () => {
    const publisher = createFakePublisher();
    const service = new FileUploadService(
      successfulUploader(),
      new CreativeConnectorEvents(publisher),
      () => new Date("2026-01-01T00:00:00Z"),
    );
    const file = unwrap(await service.upload(Buffer.from("x"), "x.jpg", "image/jpeg"));
    expect(file.fileId.toString()).toBe("file_1");
    expect(publisher.published[0]?.type).toBe("aaos.creative-connector.file.uploaded");
  });

  it("returns the error and publishes nothing on failure", async () => {
    const publisher = createFakePublisher();
    const service = new FileUploadService(
      failingUploader(),
      new CreativeConnectorEvents(publisher),
    );
    const error = unwrapErr(await service.upload(Buffer.from("x"), "x.jpg", "image/jpeg"));
    expect(error.message).toBe("upload failed");
    expect(publisher.published).toHaveLength(0);
  });

  it("forwards the correlationId to the published event", async () => {
    const publisher = createFakePublisher();
    const service = new FileUploadService(
      successfulUploader(),
      new CreativeConnectorEvents(publisher),
    );
    await service.upload(
      Buffer.from("x"),
      "x.jpg",
      "image/jpeg" as SupportedImageMimeType,
      undefined,
      "corr-9",
    );
    expect(publisher.published[0]?.correlationId).toBe("corr-9");
  });

  it("defaults `now` to the real wall clock when not injected", async () => {
    const publisher = createFakePublisher();
    const service = new FileUploadService(
      successfulUploader(),
      new CreativeConnectorEvents(publisher),
    );
    await service.upload(Buffer.from("x"), "x.jpg", "image/jpeg");
    expect(publisher.published[0]?.payload).toBeDefined();
  });
});
