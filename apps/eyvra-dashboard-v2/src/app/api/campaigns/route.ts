import { NextResponse, type NextRequest } from "next/server";
import { callAaosApi, AaosApiError } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { PortfolioCampaign } from "@/lib/campaigns";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  const headers = { "x-tenant-id": session.tenantId };
  const period = request.nextUrl.searchParams.get("period") ?? "last_7d";
  if (!["last_7d", "last_14d", "last_30d"].includes(period))
    return NextResponse.json({ error: { message: "Invalid period" } }, { status: 400 });
  try {
    const accounts = await callAaosApi<{ id: string; name: string }[]>(
      "/api/v1/meta-ads/accounts",
      { headers, timeoutMs: 30000 },
    );
    const results = await Promise.allSettled(
      accounts.map(async (account) => {
        const body = await callAaosApi<{ campaigns: PortfolioCampaign[]; syncedAt: string }>(
          "/api/v1/campaigns",
          {
            headers,
            searchParams: { adAccountId: account.id, datePreset: period },
            timeoutMs: 30000,
          },
        );
        return body.campaigns.map((c) => ({
          ...c,
          accountId: account.id,
          accountName: account.name,
          syncedAt: body.syncedAt,
        }));
      }),
    );
    if (results.length > 0 && results.every((result) => result.status === "rejected")) {
      const limited = results.some(
        (result) =>
          result.status === "rejected" &&
          result.reason instanceof AaosApiError &&
          result.reason.statusCode === 429,
      );
      return NextResponse.json(
        {
          error: {
            message: limited
              ? "Limit konektor Meta tercapai. Data campaign sementara belum dapat dimuat; coba lagi setelah limit pulih."
              : "Data campaign sementara belum dapat dimuat. Coba lagi.",
          },
        },
        { status: limited ? 429 : 503 },
      );
    }
    return NextResponse.json({
      campaigns: results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
      errors: results.flatMap((r, i) =>
        r.status === "rejected" ? [`Data ${accounts[i]?.name ?? "Meta"} tertunda. Coba lagi.`] : [],
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: { message: "Portfolio belum bisa dimuat. Coba lagi." } },
      { status: error instanceof AaosApiError ? error.statusCode : 500 },
    );
  }
}
