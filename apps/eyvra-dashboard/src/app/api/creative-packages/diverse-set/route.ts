import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type {
  DiverseCreativeBriefSetResultDto,
  SamanthaCreativeContextDto,
} from "@/types/andromeda-health.types";

export const dynamic = "force-dynamic";

/**
 * `POST /api/creative-packages/diverse-set` — proxies `POST /api/v1/creative-packages/diverse-set`
 * (Samantha Andromeda-Aware Campaign System, Sprint 2). The real body a "Brief Kai sekarang" click
 * (`AndromedaHealthCard`) sends: `listingId` (required — `creative_packages` is listing-scoped, see
 * `SchedulerService.createDiverseCreativeBriefSet`'s own doc), `campaignId`/`requestedCount`
 * optional.
 *
 * EYVRA — SAMANTHA V2 + KAI V2 Phase 23 adds `samanthaContext`: `CampaignHealthCard.tsx`'s own
 * "Brief Kai" trigger (Phase 19) can now send its real, already-fetched `CampaignDiagnosis`/
 * `SamanthaDecision` context alongside the same body — forwarded through as-is (same shallow
 * `typeof`-checked pass-through discipline this route already applies to every other field), never
 * validated deeply here (the real Zod validation lives server-side on
 * `DiverseCreativeBriefSetBodySchema`).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    readonly listingId?: unknown;
    readonly campaignId?: unknown;
    readonly requestedCount?: unknown;
    readonly samanthaContext?: SamanthaCreativeContextDto;
  };
  if (typeof body.listingId !== "string" || body.listingId.length === 0) {
    return NextResponse.json({ error: { message: "listingId is required" } }, { status: 400 });
  }

  try {
    const data = await callAaosApi<DiverseCreativeBriefSetResultDto>(
      "/api/v1/creative-packages/diverse-set",
      {
        method: "POST",
        body: {
          listingId: body.listingId,
          ...(typeof body.campaignId === "string" ? { campaignId: body.campaignId } : {}),
          ...(typeof body.requestedCount === "number"
            ? { requestedCount: body.requestedCount }
            : {}),
          ...(body.samanthaContext !== undefined ? { samanthaContext: body.samanthaContext } : {}),
        },
        headers: { "x-tenant-id": session.tenantId },
      },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
