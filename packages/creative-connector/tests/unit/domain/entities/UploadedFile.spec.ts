import { describe, expect, it } from "vitest";

import { UploadedFile } from "../../../../src/domain/entities/UploadedFile.js";
import { FileId } from "../../../../src/domain/value-objects/FileId.js";
import { FileUrl } from "../../../../src/domain/value-objects/FileUrl.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("UploadedFile", () => {
  it("creates an UploadedFile", () => {
    const uploadedAt = new Date("2026-01-01T00:00:00Z");
    const file = unwrap(
      UploadedFile.create({
        fileId: unwrap(FileId.create("file_abc1234")),
        fileUrl: unwrap(FileUrl.create("https://cdn.kie.ai/x.jpg")),
        fileName: "xpander-bintaro-001.jpg",
        uploadedAt,
      }),
    );
    expect(file.fileId.toString()).toBe("file_abc1234");
    expect(file.fileUrl.toString()).toBe("https://cdn.kie.ai/x.jpg");
    expect(file.fileName).toBe("xpander-bintaro-001.jpg");
    expect(file.uploadedAt).toBe(uploadedAt);
  });

  it("rejects an empty fileName", () => {
    const error = unwrapErr(
      UploadedFile.create({
        fileId: unwrap(FileId.create("file_1")),
        fileUrl: unwrap(FileUrl.create("https://cdn.kie.ai/x.jpg")),
        fileName: "",
        uploadedAt: new Date(),
      }),
    );
    expect(error.message).toMatch(/non-empty string/);
  });

  it("isExpired is false right after upload", () => {
    const uploadedAt = new Date("2026-01-01T00:00:00Z");
    const file = unwrap(
      UploadedFile.create({
        fileId: unwrap(FileId.create("file_1")),
        fileUrl: unwrap(FileUrl.create("https://cdn.kie.ai/x.jpg")),
        fileName: "x.jpg",
        uploadedAt,
      }),
    );
    expect(file.isExpired(new Date("2026-01-01T01:00:00Z"))).toBe(false);
  });

  it("isExpired is true 24h after upload", () => {
    const uploadedAt = new Date("2026-01-01T00:00:00Z");
    const file = unwrap(
      UploadedFile.create({
        fileId: unwrap(FileId.create("file_1")),
        fileUrl: unwrap(FileUrl.create("https://cdn.kie.ai/x.jpg")),
        fileName: "x.jpg",
        uploadedAt,
      }),
    );
    expect(file.isExpired(new Date("2026-01-02T00:00:00Z"))).toBe(true);
  });

  it("isExpired defaults `at` to the real wall clock when omitted", () => {
    const file = unwrap(
      UploadedFile.create({
        fileId: unwrap(FileId.create("file_1")),
        fileUrl: unwrap(FileUrl.create("https://cdn.kie.ai/x.jpg")),
        fileName: "x.jpg",
        uploadedAt: new Date(0),
      }),
    );
    expect(file.isExpired()).toBe(true);
  });
});
