import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { CreateTemplateInput, TemplateDto } from "@/types/dashboard.types";

/** `GET/POST /api/recycling/templates` — proxies `aaos-api`'s real `GET/POST /api/v1/recycling/templates` (TAB 2). */
export async function GET(): Promise<NextResponse> {
  try {
    const templates = await callAaosApi<readonly TemplateDto[]>("/api/v1/recycling/templates");
    return NextResponse.json({ templates });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as CreateTemplateInput;
  try {
    const template = await callAaosApi<TemplateDto>("/api/v1/recycling/templates", {
      method: "POST",
      body,
    });
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
