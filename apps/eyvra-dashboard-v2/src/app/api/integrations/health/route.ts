import { NextResponse, type NextRequest } from "next/server";
import { resolveRouteSession } from "@/lib/route-session";
import { callAaosApi } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const health = await callAaosApi("/api/v1/meta-integration/health", {
      headers: { "x-tenant-id": session.tenantId },
      timeoutMs: 55000,
    });
    return NextResponse.json(health, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json(
      { message: "Pemeriksaan integrasi gagal. Coba lagi; status siap belum terverifikasi." },
      { status: 503 },
    );
  }
}
