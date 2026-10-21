import { NextResponse, type NextRequest } from "next/server";
import { resolveRouteSession } from "@/lib/route-session";
import { AaosApiError, callAaosApi } from "@/lib/api";
export const dynamic = "force-dynamic";
async function handle(request: NextRequest, id: string, method: "GET" | "POST") {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!/^[a-f0-9-]{36}$/.test(id))
    return NextResponse.json({ message: "Invalid project ID" }, { status: 400 });
  if (
    method === "POST" &&
    (session.vertical !== "PROPERTY" ||
      !["owner", "manager", "superadmin"].includes(session.role) ||
      request.headers.get("origin") !== request.nextUrl.origin)
  )
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  try {
    const concepts = await callAaosApi(
      `/api/v1/creative-packages/handoff/projects/${id}/concepts`,
      { method, headers: { "x-tenant-id": session.tenantId }, timeoutMs: 120000 },
    );
    return NextResponse.json({ concepts }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof AaosApiError ? error.message : "Konsep belum tersedia." },
      { status: error instanceof AaosApiError ? error.statusCode : 503 },
    );
  }
}
export const GET = (request: NextRequest, { params }: { params: { id: string } }) =>
  handle(request, params.id, "GET");
export const POST = (request: NextRequest, { params }: { params: { id: string } }) =>
  handle(request, params.id, "POST");
