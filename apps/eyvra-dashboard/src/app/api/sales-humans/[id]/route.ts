import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { SalesHumanAccountDto } from "@/types/sales-human-account.types";

/** `PUT /api/sales-humans/:id` — proxies `PUT /api/v1/sales-humans/:id` (Edit modal + "Nonaktif" `{ status: "OFF" }`). */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const data = await callAaosApi<SalesHumanAccountDto>(
      `/api/v1/sales-humans/${encodeURIComponent(params.id)}`,
      { method: "PUT", body },
    );
    return NextResponse.json({ salesHuman: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
