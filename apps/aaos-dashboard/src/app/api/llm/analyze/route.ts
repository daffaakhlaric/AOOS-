import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { LlmAnalyzeResponseDto } from "@/types/dashboard.types";

/**
 * `POST /api/llm/analyze` — proxies `aaos-api`'s `POST /api/v1/llm/analyze`
 * (`docs/PROMPT-AAOS-API-LLM-TAMARA.md`, built by a sibling task; this route is written against
 * that documented contract even if the endpoint hasn't landed yet — a 404/network failure from it
 * is handled identically to any other upstream failure below).
 *
 * Body is passed straight through — the caller (Analisa page's "🤖 Analisa dengan AI" button)
 * sends `{ campaigns, totals }` reusing this app's own already-cached `AdAccountSummaryDto` shape
 * (coordinator note #6: the real backend accepts the same real `campaigns[]`/`totals` shape
 * `GET /api/v1/campaigns` returns, so no reshaping is needed here).
 *
 * Error handling (spec Section 7): this route does NOT try to distinguish "no API key configured"
 * from "OpenAI call failed" itself — every failure (any non-2xx status, or a thrown
 * network/parse error) is surfaced as a uniform `{ error }` JSON body with the upstream status
 * (or 502 for a network-level failure), and it's the CLIENT component's job to catch that and show
 * the rule-based fallback rather than the AI result, per spec Section 7's two fallback messages.
 * A 503 status is treated as this convention's "AI not configured/unavailable" signal (mirroring
 * `aaos-exception.filter.ts`'s `ErrorCode.UNAVAILABLE` → 503 mapping used elsewhere in
 * `aaos-api`); everything else is treated as "the call itself failed".
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => undefined);
  try {
    const data = await callAaosApi<LlmAnalyzeResponseDto>("/api/v1/llm/analyze", {
      method: "POST",
      body,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 502 });
  }
}
