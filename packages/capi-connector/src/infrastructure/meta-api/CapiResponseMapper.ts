import { z } from "zod";

import { EmqReport } from "../../domain/entities/EmqReport.js";
import { CapiApiError } from "../../domain/errors/CapiApiError.js";
import { EmqScore } from "../../domain/value-objects/EmqScore.js";

export const SendEventsResponseSchema = z.object({
  events_received: z.number(),
  messages: z.array(z.string()).optional(),
  fbtrace_id: z.string().optional(),
});
export type SendEventsResponse = z.infer<typeof SendEventsResponseSchema>;

export const CapiErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().optional(),
    code: z.number().optional(),
    error_subcode: z.number().optional(),
    fbtrace_id: z.string().optional(),
  }),
});

/** Meta's `server_events_metrics` diagnostics field — `emq` averaged across all reported event types. */
export const EmqDiagnosticsResponseSchema = z.object({
  id: z.string(),
  server_events_metrics: z
    .object({
      data: z.array(z.object({ emq: z.number(), events_received: z.number() })),
    })
    .optional(),
});
export type EmqDiagnosticsResponse = z.infer<typeof EmqDiagnosticsResponseSchema>;

const META_INVALID_TOKEN_CODE = 190;
const META_MISSING_PERMISSION_CODE = 200;
const DEFAULT_RETRY_AFTER_MS = 60_000;

/** Maps raw Meta CAPI HTTP responses to this package's domain shapes / `CapiApiError` subtypes — the only place that knows Meta's wire JSON. */
export class CapiResponseMapper {
  static toSendEventsResult(json: SendEventsResponse): {
    eventsReceived: number;
    fbtraceId?: string;
    messages?: readonly string[];
  } {
    return {
      eventsReceived: json.events_received,
      fbtraceId: json.fbtrace_id,
      messages: json.messages,
    };
  }

  /**
   * `EmqScore.create`/`EmqReport.create` cannot actually fail for these inputs — `avgScore` is
   * always clamped into `[0, 10]` and `eventsReceived` is always a sum of non-negative numbers.
   * A failure here would mean this mapper's own arithmetic broke an invariant it's supposed to
   * guarantee, so it throws (a programmer-error, not an expected/recoverable business failure —
   * Constitution §16) rather than threading a `Result` the caller could never meaningfully act on.
   */
  static toEmqReport(pixelId: string, json: EmqDiagnosticsResponse, capturedAt: Date): EmqReport {
    const rows = json.server_events_metrics?.data ?? [];
    const avgScore =
      rows.length === 0 ? 0 : rows.reduce((sum, row) => sum + row.emq, 0) / rows.length;
    const eventsReceived = rows.reduce((sum, row) => sum + row.events_received, 0);
    const score = unwrapInvariant(EmqScore.create(clamp(avgScore, 0, 10)));
    return unwrapInvariant(EmqReport.create({ pixelId, score, eventsReceived, capturedAt }));
  }

  static async toCapiApiError(response: Response): Promise<CapiApiError> {
    const httpStatus = response.status;
    let metaErrorCode: number | undefined;
    let message = `Meta CAPI request failed with HTTP ${httpStatus}`;
    try {
      const body: unknown = await response.json();
      const parsed = CapiErrorResponseSchema.safeParse(body);
      if (parsed.success) {
        metaErrorCode = parsed.data.error.code;
        message = parsed.data.error.message;
      }
    } catch {
      // Non-JSON error body — fall back to the generic HTTP-status-only message above.
    }

    if (metaErrorCode === META_INVALID_TOKEN_CODE) {
      return new CapiApiError(message, { metaErrorCode, httpStatus: 401 });
    }
    if (metaErrorCode === META_MISSING_PERMISSION_CODE) {
      return new CapiApiError(message, { metaErrorCode, httpStatus: 403 });
    }
    if (httpStatus === 429) {
      return new CapiApiError(message, {
        metaErrorCode,
        httpStatus,
        context: { retryAfterMs: parseRetryAfterMs(response.headers.get("retry-after")) },
      });
    }
    return new CapiApiError(message, { metaErrorCode, httpStatus });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function unwrapInvariant<T>(result: { ok: true; value: T } | { ok: false; error: Error }): T {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
}

function parseRetryAfterMs(headerValue: string | null): number {
  if (headerValue === null) {
    return DEFAULT_RETRY_AFTER_MS;
  }
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  return DEFAULT_RETRY_AFTER_MS;
}
