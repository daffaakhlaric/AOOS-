import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { BranchDto } from "@/types/dashboard.types";

/** `GET /api/branches` — proxies `GET /api/v1/branches`. */
export async function GET(): Promise<NextResponse> {
  try {
    const data = await callAaosApi<readonly BranchDto[]>("/api/v1/branches");
    return NextResponse.json({ branches: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
