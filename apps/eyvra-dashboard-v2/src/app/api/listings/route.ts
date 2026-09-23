import { NextResponse, type NextRequest } from "next/server";
import { callAaosApi, AaosApiError } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { ListingInventory } from "@/lib/listings";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  try {
    return NextResponse.json(
      await callAaosApi<ListingInventory>("/api/v1/listings/advertising-inventory", {
        headers: { "x-tenant-id": session.tenantId },
        timeoutMs: 25000,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: { message: "Data listing belum dapat dimuat. Coba lagi." } },
      { status: error instanceof AaosApiError ? error.statusCode : 503 },
    );
  }
}
