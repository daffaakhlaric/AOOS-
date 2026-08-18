/**
 * The Nano Banana Pro model identifier, sent as the `model` field to `POST /api/v1/jobs/createTask`.
 *
 * REAL BUG FIX (confirmed live against `api.kie.ai`, 2026-08-18): the earlier `"google/nano-banana-pro"`
 * value was wrong — the real API rejects it with `{"code":422,"msg":"The model name you specified
 * is not supported. ..."}`. The real, working model string (verified via a live task creation that
 * returned a real `taskId`) is `"nano-banana-pro"`, with no `google/` prefix.
 */
export enum ImageModel {
  NANO_BANANA_PRO = "nano-banana-pro",
}
