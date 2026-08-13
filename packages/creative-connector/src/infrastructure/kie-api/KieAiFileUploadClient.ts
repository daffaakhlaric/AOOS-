import { ErrorCode, err, ok, type Result } from "@aos/common";

import type { IFileUploader, SupportedImageMimeType } from "../../contracts/IFileUploader.js";
import { UploadedFile } from "../../domain/entities/UploadedFile.js";
import { FileUploadError } from "../../domain/errors/FileUploadError.js";
import { FileId } from "../../domain/value-objects/FileId.js";
import { FileUrl } from "../../domain/value-objects/FileUrl.js";

import { KieApiResponseMapper } from "./KieApiResponseMapper.js";

/** The Kie AI file-stream-upload host — a different host from the generation API (`api.kie.ai`). Kept as a named constant, not scattered string literals, so it is easy to find/change in one place. */
export const KIE_FILE_UPLOAD_BASE_URL = "https://kieai.redpandaai.co";
export const KIE_FILE_UPLOAD_PATH = "/api/file-stream-upload";
export const DEFAULT_UPLOAD_PATH = "images/aaos-dss";

const SUPPORTED_MIME_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface KieAiFileUploadClientOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  /** Injectable native `fetch` — overridable for tests (MSW normally suffices). */
  readonly fetchImpl?: typeof fetch;
  /** Injectable clock, stamped onto every successfully-uploaded `UploadedFile.uploadedAt`. */
  readonly now?: () => Date;
}

/**
 * `fetch`-based (no axios) implementation of `IFileUploader`, talking to
 * `https://kieai.redpandaai.co/api/file-stream-upload` — Part 1 of the spec. Sends a real
 * `multipart/form-data` body (native `FormData` + `Blob`, never JSON) with fields `file`,
 * `uploadPath`, `fileName`. Never retried on failure, per the spec ("On failure → FileUploadError
 * (no retry — just report)").
 */
export class KieAiFileUploadClient implements IFileUploader {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(options: KieAiFileUploadClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? KIE_FILE_UPLOAD_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? ((): Date => new Date());
  }

  async upload(
    buffer: Buffer,
    fileName: string,
    mimeType: SupportedImageMimeType,
    uploadPath: string = DEFAULT_UPLOAD_PATH,
  ): Promise<Result<UploadedFile, FileUploadError>> {
    if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
      return err(
        new FileUploadError(
          `KieAiFileUploadClient: unsupported mime type "${String(mimeType)}" — must be one of image/jpeg, image/png, image/webp`,
          {},
          ErrorCode.VALIDATION_ERROR,
        ),
      );
    }

    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mimeType }), fileName);
    form.append("uploadPath", uploadPath);
    form.append("fileName", fileName);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${KIE_FILE_UPLOAD_PATH}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: form,
      });
    } catch (error) {
      return err(
        new FileUploadError(`KieAiFileUploadClient: network failure uploading "${fileName}"`, {
          cause: error instanceof Error ? error : undefined,
        }),
      );
    }

    if (!response.ok) {
      return err(
        new FileUploadError(`KieAiFileUploadClient: upload responded with HTTP ${response.status}`),
      );
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (error) {
      return err(
        new FileUploadError("KieAiFileUploadClient: response body was not valid JSON", {
          cause: error instanceof Error ? error : undefined,
        }),
      );
    }

    const mapped = KieApiResponseMapper.mapUploadResponse(json);
    if (!mapped.ok) {
      return mapped;
    }

    const fileIdResult = FileId.create(mapped.value.fileId);
    if (!fileIdResult.ok) {
      return err(new FileUploadError(fileIdResult.error.message, { cause: fileIdResult.error }));
    }
    const fileUrlResult = FileUrl.create(mapped.value.fileUrl);
    if (!fileUrlResult.ok) {
      return err(new FileUploadError(fileUrlResult.error.message, { cause: fileUrlResult.error }));
    }

    const entityResult = UploadedFile.create({
      fileId: fileIdResult.value,
      fileUrl: fileUrlResult.value,
      fileName,
      uploadedAt: this.now(),
    });
    if (!entityResult.ok) {
      return err(new FileUploadError(entityResult.error.message, { cause: entityResult.error }));
    }
    return ok(entityResult.value);
  }
}
