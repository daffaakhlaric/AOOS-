import { NextResponse, type NextRequest } from "next/server";
import { callAaosApi, AaosApiError } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { StressTestRunDto } from "@/lib/stress-test";

/**
 * `POST /api/creative-stress-test/[id]/send-to-kai` — the "Kirim ke Kai" revision handoff for a
 * Creative Stress Test run whose `sourceType === "LISTING"` (a real `listingId` directly, no
 * campaign involved). Same real guard/validation discipline as
 * `/api/campaigns/[campaignId]/brief/route.ts` (401/403/422/400), and calls the SAME real aaos-api
 * endpoint that route calls — `POST /api/v1/creative-packages/property` — with `generate: false`,
 * i.e. this creates a real DRAFT creative-package row in Kai's queue only, never an auto-generation
 * or publish.
 *
 * For a run whose `sourceType === "CAMPAIGN"` (a real `campaignId`), the frontend calls the EXISTING
 * `/api/campaigns/[campaignId]/brief` route directly instead — that route's own campaign→listing
 * resolution already covers it, so this route deliberately does not duplicate that path (only
 * handles LISTING here, returning 422 for anything else).
 *
 * The real `listingId` is resolved SERVER-SIDE from the real, tenant-scoped run (never trusted from
 * the request body) — mirrors the campaign route's own "always resolve `listingId` from a real
 * upstream lookup, never trust the client" discipline.
 */
const ANGLES = [
  "DP_RINGAN",
  "READY_HUNI",
  "INVESTASI",
  "EXCLUSIVE",
  "SYARIAH",
  "PROMO_TERBATAS",
  "TESTIMONIAL",
  "VIRTUAL_TOUR",
];

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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
            "Brief dari Creative Stress Test ini memerlukan listing properti. Gunakan brief automotive di Kai Studio.",
        },
      },
      { status: 422 },
    );

  const body = (await request.json().catch(() => null)) as {
    angle?: string;
    message?: string;
    format?: string;
  } | null;
  if (
    !body ||
    !ANGLES.includes(body.angle ?? "") ||
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
    const run = await callAaosApi<StressTestRunDto>(
      `/api/v1/creative-stress-test/${encodeURIComponent(params.id)}`,
      { headers, timeoutMs: 15000 },
    );
    if (run.sourceType !== "LISTING" || run.listingId === undefined)
      return NextResponse.json(
        {
          error: {
            message:
              "Run ini bukan run berbasis listing langsung — gunakan alur brief campaign untuk mengirim revisi ke Kai.",
          },
        },
        { status: 422 },
      );
    if (run.status !== "COMPLETED")
      return NextResponse.json(
        {
          error: {
            message:
              "Run belum selesai dievaluasi — brief hanya dapat dikirim dari run yang COMPLETED.",
          },
        },
        { status: 422 },
      );

    const data = await callAaosApi("/api/v1/creative-packages/property", {
      method: "POST",
      headers,
      timeoutMs: 20000,
      body: {
        listingId: run.listingId,
        angle: body.angle,
        primaryMessage: body.message.trim(),
        format: body.format,
        origin: "MANUAL",
        reason: `Creative revision from Creative Stress Test run ${params.id}`,
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
