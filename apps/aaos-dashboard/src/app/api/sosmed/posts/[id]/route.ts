import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { ScheduledPostDto } from "@/types/sosmed.types";

/** `GET/PUT/DELETE /api/sosmed/posts/:id` — proxies `aaos-api`'s real `GET/PUT/DELETE /api/v1/sosmed/posts/:id`. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const post = await callAaosApi<ScheduledPostDto>(
      `/api/v1/sosmed/posts/${encodeURIComponent(params.id)}`,
    );
    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const post = await callAaosApi<ScheduledPostDto>(
      `/api/v1/sosmed/posts/${encodeURIComponent(params.id)}`,
      { method: "PUT", body },
    );
    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    await callAaosApi<void>(`/api/v1/sosmed/posts/${encodeURIComponent(params.id)}`, {
      method: "DELETE",
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
