import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { CreativePackageDto } from "@/types/dashboard.types";

/**
 * `GET /api/creative` — proxies `GET /api/v1/creative-packages`, forwarding only the filters the
 * caller set. `aaos-api` re-validates them against the real status enum (`GetPackagesQuerySchema`),
 * so a fabricated status is rejected upstream with a 422 rather than quietly dropped here.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const searchParams: Record<string, string | undefined> = {
    status: url.searchParams.get("status") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  };
  try {
    const data = await callAaosApi<readonly CreativePackageDto[]>("/api/v1/creative-packages", {
      searchParams,
    });
    return NextResponse.json({ packages: data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * `POST /api/creative` — proxies `POST /api/v1/creative-packages` (create a brief).
 *
 * The body is forwarded verbatim so `aaos-api`'s Zod schema is the single validator; in particular
 * `generate: true` (the "Kirim ke Kai — Generate Sekarang" button) is the only thing that ever
 * starts a real, billable Kie AI run, and it always originates from a human clicking on this form.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const data = await callAaosApi<CreativePackageDto>("/api/v1/creative-packages", {
      method: "POST",
      body: body ?? {},
    });
    return NextResponse.json({ package: data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AaosApiError) {
    return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
  }
  return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
}
