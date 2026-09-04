import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { TemplateDto, UpdateTemplateInput } from "@/types/dashboard.types";

/** `PUT /api/recycling/templates/:id` — proxies `aaos-api`'s real `PUT /api/v1/recycling/templates/:id` (TAB 2's "Edit" action). */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as UpdateTemplateInput;
  try {
    const template = await callAaosApi<TemplateDto>(
      `/api/v1/recycling/templates/${encodeURIComponent(params.id)}`,
      { method: "PUT", body },
    );
    return NextResponse.json({ template });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
