import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { z } from "zod";

import type { RawTaskStatusResponse } from "../../contracts/ICreativeClient.js";
import { FileUploadError } from "../../domain/errors/FileUploadError.js";
import { KieApiError } from "../../domain/errors/KieApiError.js";

// REAL BUG FIX (confirmed live against api.kie.ai, 2026-08-18): on a real error response (e.g.
// `{"code":422,"msg":"...","data":null}`), Kie AI sends `data` as an explicit JSON `null`, not an
// omitted field. `.optional()` only accepts `undefined` (a missing key) — an explicit `null` still
// failed it, so every real Kie AI error response was reported as an opaque "response failed schema
// validation" instead of the real, informative `msg` Kie AI actually sent. `.nullable().optional()`
// (i.e. `.nullish()`) accepts both shapes.
// REAL BUG FIX (live-confirmed, 2026-09-15 — the raw body diagnostic added right after the earlier
// 2026-08-18 fix caught this on its very next real failure): the design doc's own worked example
// (`docs/PROMPT-AAOS-W3G-CREATIVE-CONNECTOR.md`) documented `data: {fileId, fileUrl}`, but the REAL
// `https://kieai.redpandaai.co/api/file-stream-upload` response is `data: {success, fileName,
// filePath, downloadUrl, fileSize, mimeType}` — no `fileId`/`fileUrl` field exists at all. `filePath`
// (a real, unique per-upload path string) stands in for `fileId`; `downloadUrl` stands in for
// `fileUrl`. `msg` is also widened to `.optional()` here, matching the other two schemas below —
// there is no real evidence it is ever actually required either, and being over-strict on it is
// exactly the class of bug this fix is closing.
const UploadResponseSchema = z.object({
  success: z.boolean(),
  code: z.number(),
  msg: z.string().optional(),
  data: z
    .object({
      filePath: z.string(),
      downloadUrl: z.string(),
    })
    .nullish(),
});

const TaskCreatedResponseSchema = z.object({
  code: z.number(),
  msg: z.string().optional(),
  data: z
    .object({
      taskId: z.string(),
    })
    .nullish(),
});

const TaskStatusResponseSchema = z.object({
  code: z.number(),
  msg: z.string().optional(),
  data: z
    .object({
      taskId: z.string(),
      successFlag: z.number(),
      videoUrl: z.string().optional(),
      imageUrl: z.string().optional(),
      images: z.array(z.string()).optional(),
    })
    .nullish(),
});

export interface UploadResponseData {
  readonly fileId: string;
  readonly fileUrl: string;
}

export interface TaskCreatedResponseData {
  readonly taskId: string;
}

/**
 * REAL BUG FIX (live-confirmed: a real file-stream-upload response failed schema validation with
 * no way to tell WHICH field disagreed with `UploadResponseSchema` — every schema-validation-failure
 * message below used to be the same opaque "response failed schema validation" string, with the
 * real `ZodError` only reachable via `error.cause.context.zodError`, which the Activity Log never
 * renders). Summarizes the real, specific field(s) Zod actually rejected — e.g. `msg: Required` —
 * directly into the error message every one of these 3 branches already surfaces, same "never
 * discard a real diagnostic reason" discipline `CreativeOrchestratorService`'s own recent fix
 * (`sourcePhotoSkippedReason`) already establishes one layer up this exact call chain.
 */
function summarizeZodIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "(root)"}: ${issue.message}`)
    .join("; ");
}

/**
 * Same real-diagnostic-reason discipline as `summarizeZodIssues` — naming WHICH field Kie AI's
 * response disagreed with our schema on is only half the picture; without the real raw body
 * alongside it, answering "so what IS the real field actually called" still requires a live
 * Kie AI dashboard/network-tab session this codebase's own Activity Log cannot see into. Truncated
 * so one unexpectedly large/malformed body can never blow up the Activity Log entry.
 */
const MAX_RAW_BODY_CHARS = 300;
function truncateRawBody(json: unknown): string {
  let text: string;
  try {
    text = JSON.stringify(json);
  } catch {
    return String(json);
  }
  return text.length > MAX_RAW_BODY_CHARS
    ? `${text.slice(0, MAX_RAW_BODY_CHARS)}…(truncated)`
    : text;
}

/**
 * Translates raw Kie AI JSON response bodies (Parts 1-4 of the spec) into typed, validated
 * shapes or a `Result.err`, so the two infrastructure clients never hand-parse `unknown` JSON
 * themselves. Zod-validated per Constitution §5.5 ("all external inputs ... validated against an
 * explicit schema before use").
 */
export class KieApiResponseMapper {
  static mapUploadResponse(json: unknown): Result<UploadResponseData, FileUploadError> {
    const parsed = UploadResponseSchema.safeParse(json);
    if (!parsed.success) {
      return err(
        new FileUploadError(
          `Kie AI file-stream-upload response failed schema validation (${summarizeZodIssues(parsed.error)}) — raw body: ${truncateRawBody(json)}`,
          {
            cause: new ValidationError("schema validation failed", {
              context: { zodError: parsed.error },
            }),
          },
        ),
      );
    }
    if (!parsed.data.success || !parsed.data.data) {
      return err(
        new FileUploadError(`Kie AI file upload failed: ${parsed.data.msg ?? "unknown error"}`, {
          context: { code: parsed.data.code },
        }),
      );
    }
    // REAL BUG FIX (see UploadResponseSchema's own doc) — the real response has no fileId/fileUrl
    // fields at all; filePath/downloadUrl are the real stand-ins.
    return ok({ fileId: parsed.data.data.filePath, fileUrl: parsed.data.data.downloadUrl });
  }

  static mapTaskCreatedResponse(json: unknown): Result<TaskCreatedResponseData, KieApiError> {
    const parsed = TaskCreatedResponseSchema.safeParse(json);
    if (!parsed.success) {
      return err(
        new KieApiError(
          `Kie AI task-creation response failed schema validation (${summarizeZodIssues(parsed.error)}) — raw body: ${truncateRawBody(json)}`,
          {
            cause: new ValidationError("schema validation failed", {
              context: { zodError: parsed.error },
            }),
          },
        ),
      );
    }
    if (parsed.data.code !== 200 || !parsed.data.data) {
      return err(
        new KieApiError(`Kie AI task creation failed: ${parsed.data.msg ?? "unknown error"}`, {
          context: { code: parsed.data.code },
        }),
      );
    }
    return ok(parsed.data.data);
  }

  static mapTaskStatusResponse(json: unknown): Result<RawTaskStatusResponse, KieApiError> {
    const parsed = TaskStatusResponseSchema.safeParse(json);
    if (!parsed.success) {
      return err(
        new KieApiError(
          `Kie AI task-status response failed schema validation (${summarizeZodIssues(parsed.error)}) — raw body: ${truncateRawBody(json)}`,
          {
            cause: new ValidationError("schema validation failed", {
              context: { zodError: parsed.error },
            }),
          },
        ),
      );
    }
    if (parsed.data.code !== 200 || !parsed.data.data) {
      return err(
        new KieApiError(`Kie AI task status query failed: ${parsed.data.msg ?? "unknown error"}`, {
          context: { code: parsed.data.code },
        }),
      );
    }
    return ok(parsed.data.data);
  }
}
