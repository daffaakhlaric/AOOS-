/**
 * Meta rate-limit UX (docs/PROMPT-AAOS-GEO-TARGETING-AND-REGION-PICKER.md Part C, point 2).
 *
 * Real finding: `useCampaignsSnapshot.ts`'s `pull()` and `AnalyticsHeatmapClient.tsx`'s `load()`
 * both discarded the real upstream error entirely on a non-2xx response — `if (!res.ok) { throw
 * new Error("Gagal menarik data iklan.") }` — never reading the real `{ error: { message } }` body
 * `/api/campaigns/route.ts`/`/api/analytics/heatmap/route.ts` (via `AaosApiError`) already return.
 * That means Meta's real 503 "User request limit reached" (`ApiServerError` from
 * `packages/meta-ads-connector`'s `MetaApiClient.toMetaApiError`, surfaced by `aaos-api`'s
 * `ErrorCode.UNAVAILABLE` → HTTP 503 mapping) was never shown at all — a hard-coded generic string
 * every time, worse than "raw but legible".
 *
 * This is the real, contained, low-risk fix: read the real upstream message, and when it's
 * Meta's own real rate-limit signature, replace it with a clearer Indonesian message. Any other
 * real upstream message is now shown as-is (still strictly better than the previous silent
 * discard), and a body that can't be parsed at all falls back to `fallback`.
 */
export async function friendlyApiErrorMessage(res: Response, fallback: string): Promise<string> {
  let upstreamMessage: string | undefined;
  try {
    const body: unknown = await res.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error?: unknown }).error === "object" &&
      (body as { error: unknown }).error !== null
    ) {
      const message = (body as { error: { message?: unknown } }).error.message;
      if (typeof message === "string" && message.length > 0) {
        upstreamMessage = message;
      }
    }
  } catch {
    // Non-JSON error body — fall through to `fallback` below, same as before this fix.
  }

  if (
    res.status === 503 &&
    upstreamMessage !== undefined &&
    /user request limit reached/i.test(upstreamMessage)
  ) {
    return "Meta API sedang membatasi permintaan, coba lagi dalam beberapa menit.";
  }

  return upstreamMessage ?? fallback;
}
