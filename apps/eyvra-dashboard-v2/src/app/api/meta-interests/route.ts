import { NextResponse, type NextRequest } from "next/server";
import { callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const data = await callAaosApi(
      "/api/v1/meta-interests?tenantId=" + encodeURIComponent(session.tenantId),
    );
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json(
      { message: "Katalog Meta interest belum dapat dimuat." },
      { status: 503 },
    );
  }
}
