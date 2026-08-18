import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { AssetDownloadDto } from "@/types/dashboard.types";

/**
 * `GET /api/assets/:id/download` — proxies `GET /api/v1/assets/:id/download`, which returns a real,
 * time-limited GCS V4 signed read URL. Passed back to the client as JSON (not as a redirect) so the
 * client component can open it in a new tab itself; the signed URL is what the browser then hits
 * directly, never `aaos-api`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const expiresIn = new URL(request.url).searchParams.get("expiresIn") ?? undefined;
  try {
    const data = await callAaosApi<AssetDownloadDto>(
      `/api/v1/assets/${encodeURIComponent(params.id)}/download`,
      { searchParams: { expiresIn } },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
