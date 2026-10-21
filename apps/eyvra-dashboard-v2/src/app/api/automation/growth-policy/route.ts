import { NextResponse, type NextRequest } from "next/server";
import { callAaosApi, AaosApiError } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
export const dynamic = "force-dynamic";
async function proxy(request: NextRequest, write: boolean) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canEdit = ["owner", "manager", "superadmin"].includes(session.role);
  if (write && !canEdit) return NextResponse.json({ error: "Akses hanya-baca." }, { status: 403 });
  try {
    const data = await callAaosApi<Record<string, unknown>>("/api/v1/automation/growth-policy", {
      method: write ? "PUT" : "GET",
      ...(write ? { body: await request.json() } : {}),
      headers: {
        "x-tenant-id": session.tenantId,
        "x-user-id": session.userId,
        "x-user-role": session.role,
      },
    });
    return NextResponse.json({ ...data, canEdit });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Pengaturan belum tersedia." },
      { status: e instanceof AaosApiError ? e.statusCode : 500 },
    );
  }
}
export function GET(r: NextRequest) {
  return proxy(r, false);
}
export function PUT(r: NextRequest) {
  return proxy(r, true);
}
