import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { CreateScheduledPostInput, ScheduledPostDto } from "@/types/sosmed.types";

/** `GET/POST /api/sosmed/posts` — proxies `aaos-api`'s real `GET/POST /api/v1/sosmed/posts`. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  try {
    const posts = await callAaosApi<readonly ScheduledPostDto[]>("/api/v1/sosmed/posts", {
      searchParams: { status },
    });
    return NextResponse.json({ posts });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as CreateScheduledPostInput;
  try {
    const post = await callAaosApi<ScheduledPostDto>("/api/v1/sosmed/posts", {
      method: "POST",
      body,
    });
    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
