import { NextResponse, type NextRequest } from "next/server";
import { callAaosApi, AaosApiError } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
export async function POST(request: NextRequest, { params }: { params: { campaignId: string } }) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  if (session.role === "sales")
    return NextResponse.json(
      { error: { message: "Hanya manager atau owner yang dapat mengirim brief." } },
      { status: 403 },
    );
  if (session.vertical !== "PROPERTY")
    return NextResponse.json(
      {
        error: {
          message:
            "Brief otomatis dari campaign ini memerlukan listing properti. Gunakan brief automotive di Kai Studio.",
        },
      },
      { status: 422 },
    );
  const body = (await request.json().catch(() => null)) as {
    angle?: string;
    message?: string;
    format?: string;
  } | null;
  const angles = [
    "DP_RINGAN",
    "READY_HUNI",
    "INVESTASI",
    "EXCLUSIVE",
    "SYARIAH",
    "PROMO_TERBATAS",
    "TESTIMONIAL",
    "VIRTUAL_TOUR",
  ];
  if (
    !body ||
    !angles.includes(body.angle ?? "") ||
    typeof body.message !== "string" ||
    !body.message.trim() ||
    body.message.length > 2000 ||
    !["IMAGES_ONLY", "VIDEO_AND_IMAGES"].includes(body.format ?? "")
  )
    return NextResponse.json(
      { error: { message: "Lengkapi angle, format, dan brief (maksimal 2.000 karakter)." } },
      { status: 400 },
    );
  const headers = { "x-tenant-id": session.tenantId };
  try {
    const mapping = await callAaosApi<{ listingId: string | null }>(
      `/api/v1/campaigns/${encodeURIComponent(params.campaignId)}/listing-id`,
      { headers, timeoutMs: 15000 },
    );
    if (!mapping.listingId)
      return NextResponse.json(
        { error: { message: "Hubungkan listing campaign sebelum mengirim brief ke Kai." } },
        { status: 422 },
      );
    const data = await callAaosApi("/api/v1/creative-packages/property", {
      method: "POST",
      headers,
      timeoutMs: 20000,
      body: {
        listingId: mapping.listingId,
        angle: body.angle,
        primaryMessage: body.message.trim(),
        format: body.format,
        origin: "MANUAL",
        reason: `Creative refresh for campaign ${params.campaignId}`,
        generate: false,
      },
    });
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: { message: "Brief belum tersimpan. Coba lagi." } },
      { status: e instanceof AaosApiError ? e.statusCode : 500 },
    );
  }
}
