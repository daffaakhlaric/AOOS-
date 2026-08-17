import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { AdAccountOptionDto } from "@/types/dashboard.types";

/**
 * `GET /api/meta-ads-accounts` — proxies `aaos-api`'s real `GET /api/v1/meta-ads/accounts`
 * (`docs/PROMPT-AAOS-DASHBOARD-LEAD-SPEND-CABANG-SOURCE.md` coordinator note #6), resolving one
 * `{ id, name }` pair per configured `META_AD_ACCOUNT_IDS` entry. Backs the "Lead & Spend per
 * Cabang × Source" card's multi-account pill selector — same `callAaosApi()` server-only pattern
 * as every other route in this app, so the browser never sees `AAOS_API_KEY`.
 *
 * No caching layer of its own (unlike `/api/campaigns`): the account id→name mapping changes
 * essentially never (renaming a Meta ad account is rare and this list is small — at most a
 * handful of entries), so `aaos-api`'s own per-request cost (one lightweight `fields=name` Graph
 * API call per configured account, not a full campaign pull) is cheap enough not to warrant a
 * second cache here.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const accounts = await callAaosApi<readonly AdAccountOptionDto[]>("/api/v1/meta-ads/accounts");
    return NextResponse.json(accounts);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
