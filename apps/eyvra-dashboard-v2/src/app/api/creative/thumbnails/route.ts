import { NextResponse, type NextRequest } from "next/server";
import { callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
export async function POST(request: NextRequest) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { refs?: unknown[] } | null;
  if (!Array.isArray(body?.refs) || body.refs.length > 50)
    return NextResponse.json({ error: { message: "Invalid media request" } }, { status: 400 });
  try {
    return NextResponse.json(
      await callAaosApi("/api/v1/meta-ads/creative-thumbnails", {
        method: "POST",
        body,
        headers: { "x-tenant-id": session.tenantId },
        timeoutMs: 20000,
      }),
    );
  } catch {
    return NextResponse.json(
      { error: { message: "Preview media belum dapat dimuat." } },
      { status: 503 },
    );
  }
}
