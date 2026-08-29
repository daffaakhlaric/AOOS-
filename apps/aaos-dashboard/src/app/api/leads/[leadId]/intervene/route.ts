import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { MessageDto } from "@/types/dashboard.types";

interface InterveneBody {
  readonly message: string;
  readonly managerName?: string;
}

/**
 * `POST /api/leads/:leadId/intervene` — proxies `aaos-api`'s `POST /api/v1/leads/:id/intervene`
 * (manager-as-Clara). Persisted server-side with `sender_type = 'MANAGER_INTERVENTION'`, never
 * `'CLARA'` — see `aaos-api`'s `intervene.dto.ts` docstring for the coordinator note this
 * corrects.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } },
): Promise<NextResponse> {
  const body = (await request.json()) as InterveneBody;
  try {
    const message = await callAaosApi<MessageDto>(
      `/api/v1/leads/${encodeURIComponent(params.leadId)}/intervene`,
      { method: "POST", body },
    );
    return NextResponse.json(message);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
