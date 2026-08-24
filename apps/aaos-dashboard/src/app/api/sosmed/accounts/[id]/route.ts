import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";

/** `DELETE /api/sosmed/accounts/:id` — proxies `aaos-api`'s real `DELETE /api/v1/sosmed/accounts/:id` ("Disconnect" button). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    await callAaosApi<void>(`/api/v1/sosmed/accounts/${encodeURIComponent(params.id)}`, {
      method: "DELETE",
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
