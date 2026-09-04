import { NextResponse } from "next/server";

import { AaosApiError, streamAaosApi } from "@/lib/api";

/**
 * `GET /api/scraper/jobs/:jobId/stream` — server-side proxy for `aaos-api`'s real `@Sse()` progress
 * stream (`GET /api/v1/scraper/jobs/:jobId/stream`).
 *
 * This route exists for a concrete, non-negotiable reason, not just for symmetry with the other
 * proxies: the browser's native `EventSource` cannot set request headers, so it can never send the
 * `x-api-key` header `aaos-api`'s `ApiKeyGuard` requires. This route holds the real key
 * (server-only, never `NEXT_PUBLIC_`) and forwards the upstream `text/event-stream` body through
 * untouched — the same hard "client components never call aaos-api directly" rule every other
 * `/api/*` route in this app follows.
 *
 * The upstream body is piped, not buffered: returning `response.body` directly keeps frames flowing
 * to the browser as `aaos-api` writes them (buffering would defeat the entire point of SSE).
 * `X-Accel-Buffering: no` disables proxy-level response buffering on deployments that honor it
 * (nginx and Vercel both do), which otherwise holds frames back until the stream closes.
 */
export async function GET(
  _request: Request,
  { params }: { params: { jobId: string } },
): Promise<Response> {
  try {
    const upstream = await streamAaosApi(
      `/api/v1/scraper/jobs/${encodeURIComponent(params.jobId)}/stream`,
    );
    if (upstream.body === null) {
      return NextResponse.json(
        { error: { message: "aaos-api returned an empty progress stream" } },
        { status: 502 },
      );
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
