import { NextResponse, type NextRequest } from "next/server";
import { resolveRouteSession } from "@/lib/route-session";
import { callAaosApi } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const accounts = await callAaosApi<{ id: string; name: string }[]>(
      "/api/v1/meta-ads/accounts",
      { headers: { "x-tenant-id": session.tenantId }, timeoutMs: 15000 },
    );
    return NextResponse.json(
      accounts.map(({ id, name }) => ({ id, name })),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ message: "Meta connection unavailable" }, { status: 503 });
  }
}
