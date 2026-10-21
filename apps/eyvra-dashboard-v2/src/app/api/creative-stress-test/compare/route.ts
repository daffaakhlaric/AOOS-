import { NextResponse, type NextRequest } from "next/server";
import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { StressTestRunDto } from "@/lib/stress-test";
import { compareSimulationRuns } from "@/lib/simulation-compare";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const ids = [request.nextUrl.searchParams.get("runA"), request.nextUrl.searchParams.get("runB")];
  if (ids.some((id) => !id || !/^[a-zA-Z0-9-]{1,128}$/.test(id)))
    return NextResponse.json({ message: "Pilih dua run yang valid." }, { status: 400 });
  try {
    const runs = await Promise.all(
      ids.map((id) =>
        callAaosApi<StressTestRunDto>(`/api/v1/creative-stress-test/${encodeURIComponent(id!)}`, {
          headers: { "x-tenant-id": session.tenantId },
        }),
      ),
    );
    return NextResponse.json(compareSimulationRuns(runs[0]!, runs[1]!), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { message: "Run perbandingan belum dapat dimuat. Periksa akses run dan coba lagi." },
      { status: error instanceof AaosApiError ? error.statusCode : 503 },
    );
  }
}
