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
const UploadResponseSchema = z.object({
  success: z.boolean(),
  code: z.number(),
  msg: z.string(),
  data: z
    .object({
      fileId: z.string(),
      fileUrl: z.string(),
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
          `Kie AI file-stream-upload response failed schema validation (${summarizeZodIssues(parsed.error)})`,
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
        new FileUploadError(`Kie AI file upload failed: ${parsed.data.msg}`, {
          context: { code: parsed.data.code },
        }),
      );
    }
    return ok(parsed.data.data);
  }

  static mapTaskCreatedResponse(json: unknown): Result<TaskCreatedResponseData, KieApiError> {
    const parsed = TaskCreatedResponseSchema.safeParse(json);
    if (!parsed.success) {
      return err(
        new KieApiError(
          `Kie AI task-creation response failed schema validation (${summarizeZodIssues(parsed.error)})`,
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
          `Kie AI task-status response failed schema validation (${summarizeZodIssues(parsed.error)})`,
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
