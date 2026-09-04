import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { CompetitorPageDto, CreateCompetitorPageInput } from "@/types/dashboard.types";

/** `GET/POST /api/competitors` — proxies `aaos-api`'s real `GET/POST /api/v1/competitors`. */
export async function GET(): Promise<NextResponse> {
  try {
    const competitors = await callAaosApi<readonly CompetitorPageDto[]>("/api/v1/competitors");
    return NextResponse.json({ competitors });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as CreateCompetitorPageInput;
  try {
    const competitor = await callAaosApi<CompetitorPageDto>("/api/v1/competitors", {
      method: "POST",
      body,
    });
    return NextResponse.json({ competitor }, { status: 201 });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
