import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { CreativePackageDto } from "@/types/dashboard.types";

/** `POST /api/creative/:id/approve` — proxies `POST /api/v1/creative-packages/:id/approve`. */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const data = await callAaosApi<CreativePackageDto>(
      `/api/v1/creative-packages/${encodeURIComponent(params.id)}/approve`,
      { method: "POST", body: body ?? {} },
    );
    return NextResponse.json({ package: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
