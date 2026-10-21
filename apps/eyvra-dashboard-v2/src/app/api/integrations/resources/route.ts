import { NextResponse, type NextRequest } from "next/server";
import { resolveRouteSession } from "@/lib/route-session";
import { AaosApiError, callAaosApi } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(
      await callAaosApi("/api/v1/meta-integration/resources", {
        headers: { "x-tenant-id": session.tenantId },
        timeoutMs: 90000,
      }),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { message: "Aset Meta belum dapat dimuat. Periksa koneksi dan izin bisnis." },
      { status: 503 },
    );
  }
}
export async function PUT(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ message: "Origin denied" }, { status: 403 });
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const result = await callAaosApi("/api/v1/meta-integration/destinations", {
      method: "PUT",
      body: await request.json(),
      headers: { "x-tenant-id": session.tenantId },
      timeoutMs: 90000,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof AaosApiError ? error.message : "Pilihan aset gagal disimpan." },
      { status: error instanceof AaosApiError ? error.statusCode : 400 },
    );
  }
}
