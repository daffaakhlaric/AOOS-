import { NextResponse, type NextRequest } from "next/server";
import { resolveRouteSession } from "@/lib/route-session";
import { AaosApiError, callAaosApi } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (session.vertical !== "PROPERTY")
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(params.id))
    return NextResponse.json({ message: "Invalid project ID" }, { status: 400 });
  try {
    const jobs = await callAaosApi(`/api/v1/creative-packages/handoff/projects/${params.id}/jobs`, {
      headers: { "x-tenant-id": session.tenantId },
      timeoutMs: 30000,
    });
    return NextResponse.json({ jobs }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof AaosApiError ? error.message : "Status produksi gagal dimuat." },
      { status: error instanceof AaosApiError ? error.statusCode : 503 },
    );
  }
}
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (
    session.vertical !== "PROPERTY" ||
    !["owner", "manager", "superadmin"].includes(session.role) ||
    request.headers.get("origin") !== request.nextUrl.origin
  )
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  if (!/^[a-f0-9-]{36}$/.test(params.id))
    return NextResponse.json({ message: "Invalid project ID" }, { status: 400 });
  let body: {
    conceptIds?: string[];
    renderMode?: "FULL" | "SAMPLE";
    reviewedRevisions?: Record<string, number>;
  } = {};
  try {
    body = await request.json();
    if (!body || typeof body !== "object") throw new Error("Invalid body");
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }
  if (
    !Array.isArray(body.conceptIds) ||
    body.conceptIds.length < 1 ||
    body.conceptIds.length > 10 ||
    body.conceptIds.some((id) => typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id))
  )
    return NextResponse.json({ message: "conceptIds tidak valid" }, { status: 400 });
  if (body.renderMode !== undefined && !["FULL", "SAMPLE"].includes(body.renderMode))
    return NextResponse.json({ message: "Invalid render mode" }, { status: 400 });
  if (body.renderMode === "SAMPLE" && body.conceptIds.length !== 1)
    return NextResponse.json({ message: "Pilih satu konsep untuk sample" }, { status: 400 });
  try {
    const jobs = await callAaosApi(`/api/v1/creative-packages/handoff/projects/${params.id}/jobs`, {
      method: "POST",
      headers: { "x-tenant-id": session.tenantId },
      body: {
        conceptIds: body.conceptIds,
        renderMode: body.renderMode ?? "FULL",
        reviewedRevisions: body.reviewedRevisions,
      },
      timeoutMs: 30000,
    });
    return NextResponse.json({ jobs }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof AaosApiError ? error.message : "Antrean produksi gagal." },
      { status: error instanceof AaosApiError ? error.statusCode : 503 },
    );
  }
}
