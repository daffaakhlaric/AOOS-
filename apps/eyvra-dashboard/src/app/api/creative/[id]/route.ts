import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { CreativePackageDetailDto } from "@/types/dashboard.types";

/**
 * `GET /api/creative/:id` — proxies `GET /api/v1/creative-packages/:id`, the REAL single-item
 * lookup (package + its own log trail). Replaces the detail page's previous workaround of
 * re-fetching the whole list and `.find()`-ing client-side, which existed only because no
 * single-item endpoint had been built yet.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const data = await callAaosApi<CreativePackageDetailDto>(
      `/api/v1/creative-packages/${encodeURIComponent(params.id)}`,
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
