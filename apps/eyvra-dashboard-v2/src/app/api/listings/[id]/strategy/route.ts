import { NextResponse, type NextRequest } from "next/server";
import { callAaosApi, AaosApiError } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  const objective = request.nextUrl.searchParams.get("objective");
  if (!objective)
    return NextResponse.json({ error: { message: "Pilih Growth Objective." } }, { status: 400 });
  try {
    return NextResponse.json(
      await callAaosApi(
        "/api/v1/campaign-creation/growth-objectives/" +
          encodeURIComponent(objective) +
          "/listings/" +
          encodeURIComponent(params.id) +
          "/blueprint",
        { headers: { "x-tenant-id": session.tenantId }, timeoutMs: 25000 },
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: { message: "Strategi listing belum dapat dimuat." } },
      { status: error instanceof AaosApiError ? error.statusCode : 503 },
    );
  }
}
