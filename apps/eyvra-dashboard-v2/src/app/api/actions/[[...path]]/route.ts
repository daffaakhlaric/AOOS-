import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";

export const dynamic = "force-dynamic";
type Context = { params: { path?: string[] } };
async function proxy(request: NextRequest, { params }: Context, method: "GET" | "POST") {
  const path = params.path ?? [];
  const validId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  if (
    method === "GET"
      ? path.length > 2 ||
        (path.length > 0 && !validId.test(path[0]!)) ||
        (path.length === 2 && path[1] !== "preflight")
      : path.length !== 2 || !validId.test(path[0]!) || !["approve", "execute"].includes(path[1]!)
  )
    return NextResponse.json({ error: { message: "Aksi tidak valid." } }, { status: 400 });
  if (method === "POST" && request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json({ error: { message: "Origin tidak diizinkan." } }, { status: 403 });
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  const canManage = ["owner", "manager", "superadmin"].includes(session.role);
  if (method === "POST" && !canManage)
    return NextResponse.json({ error: { message: "Akses hanya-baca." } }, { status: 403 });
  let body: unknown;
  if (method === "POST") {
    body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body))
      return NextResponse.json({ error: { message: "Body tidak valid." } }, { status: 400 });
    const keys = Object.keys(body);
    if (
      path[1] === "approve"
        ? keys.length !== 1 ||
          keys[0] !== "commandHash" ||
          !/^[a-f0-9]{64}$/.test(String((body as Record<string, unknown>).commandHash))
        : keys.length !== 0
    )
      return NextResponse.json(
        { error: { message: "Payload aksi tidak valid." } },
        { status: 400 },
      );
  }
  try {
    const data = await callAaosApi(`/api/v1/actions${path.length ? "/" + path.join("/") : ""}`, {
      method,
      headers: { "x-tenant-id": session.tenantId },
      ...(body ? { body } : {}),
      timeoutMs: 60000,
    });
    return NextResponse.json(path.length === 0 ? { actions: data, canManage } : data);
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          message:
            error instanceof AaosApiError
              ? error.message
              : "Status belum dapat dipastikan. Muat ulang sebelum mencoba lagi.",
        },
      },
      { status: error instanceof AaosApiError ? error.statusCode : 503 },
    );
  }
}
export const GET = (request: NextRequest, context: Context) => proxy(request, context, "GET");
export const POST = (request: NextRequest, context: Context) => proxy(request, context, "POST");
