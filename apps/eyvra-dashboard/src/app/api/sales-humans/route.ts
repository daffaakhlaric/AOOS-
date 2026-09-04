import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { SalesHumanAccountDto } from "@/types/sales-human-account.types";

/** `GET /api/sales-humans?branchId=` — proxies `GET /api/v1/sales-humans` (AAOS-SALES-MGMT-CRM-AUTH Part 1's "Sales Team" card, now sourced from the real Supabase-backed accounts, not the in-memory branch-manager registry). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const branchId = request.nextUrl.searchParams.get("branchId") ?? undefined;
  try {
    const data = await callAaosApi<readonly SalesHumanAccountDto[]>("/api/v1/sales-humans", {
      searchParams: { branchId },
    });
    return NextResponse.json({ salesHumans: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}

/** `POST /api/sales-humans` — proxies `POST /api/v1/sales-humans` (Part 1's Add Sales Modal). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const data = await callAaosApi<SalesHumanAccountDto>("/api/v1/sales-humans", {
      method: "POST",
      body,
    });
    return NextResponse.json({ salesHuman: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
