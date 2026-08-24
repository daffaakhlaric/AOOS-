import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { ScheduledPostDto } from "@/types/sosmed.types";

/** `POST /api/sosmed/posts/:id/publish-now` — proxies `aaos-api`'s real `POST /api/v1/sosmed/posts/:id/publish-now` ("Post Sekarang" button). */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const body = (await request.json().catch(() => undefined)) as unknown;
  try {
    const post = await callAaosApi<ScheduledPostDto>(
      `/api/v1/sosmed/posts/${encodeURIComponent(params.id)}/publish-now`,
      { method: "POST", ...(body !== undefined ? { body } : {}) },
    );
    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
