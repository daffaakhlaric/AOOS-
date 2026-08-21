import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { AbTestDto, CreateAbTestInput } from "@/types/dashboard.types";

/** `GET/POST /api/abtesting` — proxies `aaos-api`'s real `GET/POST /api/v1/abtesting`. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  try {
    const tests = await callAaosApi<readonly AbTestDto[]>("/api/v1/abtesting", {
      searchParams: { status: status ?? undefined },
    });
    return NextResponse.json({ tests });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as CreateAbTestInput;
  try {
    const test = await callAaosApi<AbTestDto>("/api/v1/abtesting", { method: "POST", body });
    return NextResponse.json({ test }, { status: 201 });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
