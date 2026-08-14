import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { LlmChatResponseDto } from "@/types/dashboard.types";

/**
 * `POST /api/llm/chat` — proxies `aaos-api`'s `POST /api/v1/llm/chat`
 * (`docs/PROMPT-AAOS-API-LLM-TAMARA.md`). Body `{ messages, context }` is passed straight through
 * from the Simulasi page's Tamara chat widget.
 *
 * Same uniform error envelope as `/api/llm/analyze` — see that route's docstring.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => undefined);
  try {
    const data = await callAaosApi<LlmChatResponseDto>("/api/v1/llm/chat", {
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
