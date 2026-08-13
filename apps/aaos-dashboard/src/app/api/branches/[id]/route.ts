import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { BranchDto } from "@/types/dashboard.types";

/** `PUT /api/branches/:id` — proxies `PUT /api/v1/branches/:id` (spec "branches/route.ts"; see AAOS-W4A coordinator note #5 on `aaos-api`'s side for how that endpoint dispatches this body to several `@aos/branch-manager` use cases). */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const data = await callAaosApi<BranchDto>(`/api/v1/branches/${encodeURIComponent(params.id)}`, {
      method: "PUT",
      body,
    });
    return NextResponse.json({ branch: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
