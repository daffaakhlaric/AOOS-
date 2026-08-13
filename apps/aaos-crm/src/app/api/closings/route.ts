import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { ClosingDto } from "@/types/crm.types";

/** `POST /api/closings` — proxies `aaos-api`'s `POST /api/v1/closings`. Powers `/closing/new`. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: unknown = await request.json();
  try {
    const closing = await callAaosApi<ClosingDto>("/api/v1/closings", { method: "POST", body });
    return NextResponse.json(closing, { status: 201 });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}

/** `GET /api/closings?salesHumanId=...` — proxies `aaos-api`'s `GET /api/v1/closings`. Powers `/closing`. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const salesHumanId = request.nextUrl.searchParams.get("salesHumanId");
  if (salesHumanId === null || salesHumanId.length === 0) {
    return NextResponse.json({ error: { message: "salesHumanId is required" } }, { status: 400 });
  }

  try {
    const closings = await callAaosApi<readonly ClosingDto[]>("/api/v1/closings", {
      searchParams: { salesHumanId },
    });
    return NextResponse.json({ closings });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
