import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { LlmCreativeBriefResponseDto } from "@/types/dashboard.types";

/**
 * `POST /api/llm/creative-brief` — proxies `aaos-api`'s `POST /api/v1/llm/creative-brief`
 * (`docs/PROMPT-AAOS-API-LLM-TAMARA.md`). Body `{ ad, angle, branch }` is passed straight through
 * from the Simulasi page's "Generate Brief" button (Step 2).
 *
 * Same uniform error envelope as `/api/llm/analyze` — see that route's docstring. The Simulasi
 * page falls back to the hardcoded example brief from the spec's mockup (Step 2's own hardcoded
 * `CreativeBrief` shape) when this fails, rather than blocking the simulation flow.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => undefined);
  try {
    const data = await callAaosApi<LlmCreativeBriefResponseDto>("/api/v1/llm/creative-brief", {
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
