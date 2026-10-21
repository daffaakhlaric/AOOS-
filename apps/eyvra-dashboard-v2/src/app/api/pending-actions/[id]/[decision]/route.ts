import { NextResponse, type NextRequest } from "next/server";
import { callAaosApi, AaosApiError } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; decision: string } },
) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  if (!["owner", "manager", "superadmin"].includes(session.role))
    return NextResponse.json({ error: { message: "Akses hanya-baca." } }, { status: 403 });
  if (!["approve", "reject"].includes(params.decision) || !/^[\w-]+$/.test(params.id))
    return NextResponse.json({ error: { message: "Aksi tidak valid." } }, { status: 400 });
  try {
    const body = await request.json();
    if (typeof body.decisionNotes !== "string" || body.decisionNotes.length > 2000)
      return NextResponse.json({ error: { message: "Catatan tidak valid." } }, { status: 400 });
    const data = await callAaosApi(
      `/api/v1/pending-actions/${encodeURIComponent(params.id)}/${params.decision}`,
      {
        method: "POST",
        headers: { "x-tenant-id": session.tenantId },
        body: { decidedBy: session.userId, decisionNotes: body.decisionNotes },
      },
    );
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      {
        error: {
          message:
            e instanceof AaosApiError
              ? e.message
              : "Keputusan belum dapat diproses. Muat ulang status sebelum mencoba lagi.",
        },
      },
      { status: e instanceof AaosApiError ? e.statusCode : 500 },
    );
  }
}
