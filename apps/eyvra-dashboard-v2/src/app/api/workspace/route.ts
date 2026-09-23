import { NextResponse, type NextRequest } from "next/server";
import { resolveRouteSession } from "@/lib/route-session";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  return NextResponse.json(
    {
      email: session.email,
      tenantId: session.tenantId,
      vertical: session.vertical,
      role: session.role,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
