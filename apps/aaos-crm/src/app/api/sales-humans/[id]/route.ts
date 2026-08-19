import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { SalesHumanAccountDto } from "@/types/crm.types";

/**
 * `GET/PUT /api/sales-humans/:id` — proxies `aaos-api`'s `GET`less (this app has no list use) and
 * `PUT /api/v1/sales-humans/:id`, used by `/profile`'s self-service edit (AAOS-SALES-MGMT-CRM-AUTH
 * coordinator note #1 — name/phone/email update the real row, `aaos-api` handles the Supabase Auth
 * side when `email` is present; password changes on `/profile` go through
 * `supabase.auth.updateUser` client-side instead, never through this route).
 *
 * No server-side check that `:id` is the caller's own `salesHumanId` — `aaos-api`'s
 * `x-api-key` guard is service-to-service, not user-scoped. `/profile`'s client only ever sends its
 * own `session.salesHumanId`, matching this app's existing trust model (`/api/leads/:leadId/claim`
 * etc. have the same shape); documented as a known limitation in the final report.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const data = await callAaosApi<readonly SalesHumanAccountDto[]>("/api/v1/sales-humans");
    const found = data.find((sales) => sales.id === params.id);
    if (found === undefined) {
      return NextResponse.json({ error: { message: "Sales human not found" } }, { status: 404 });
    }
    return NextResponse.json(found);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}

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
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
