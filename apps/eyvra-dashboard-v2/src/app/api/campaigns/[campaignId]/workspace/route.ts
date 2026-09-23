import { NextResponse, type NextRequest } from "next/server";
import { callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import {
  referencesCampaign,
  type WorkspaceData,
  type CampaignExperiment,
  type CampaignLead,
  type CampaignPackage,
  type CampaignActivity,
} from "@/lib/campaign-workspace";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: { campaignId: string } }) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  const id = params.campaignId;
  const options = { headers: { "x-tenant-id": session.tenantId }, timeoutMs: 20000 };
  const output: WorkspaceData = { errors: [] };
  const reads = [
    [
      "Lead quality",
      async () => {
        output.leads = await callAaosApi<CampaignLead[]>(
          `/api/v1/leads/campaign/${encodeURIComponent(id)}`,
          options,
        );
      },
    ],
    [
      "Experiments",
      async () => {
        output.tests = (
          await callAaosApi<CampaignExperiment[]>("/api/v1/abtesting", options)
        ).filter((t) => t.campaignId === id);
      },
    ],
    [
      "Kai Creative",
      async () => {
        output.packages = await callAaosApi<CampaignPackage[]>("/api/v1/creative-packages", {
          ...options,
          searchParams: { limit: "200" },
        });
      },
    ],
    [
      "History",
      async () => {
        const body = await callAaosApi<{ activities: CampaignActivity[] }>("/api/v1/activity-log", {
          ...options,
          searchParams: { limit: "500" },
        });
        output.activities = body.activities.filter(
          (a) =>
            referencesCampaign(a.input, id) ||
            referencesCampaign(a.output, id) ||
            referencesCampaign(a.toolCalls, id),
        );
      },
    ],
    [
      "Listing",
      async () => {
        output.listingId = (
          await callAaosApi<{ listingId: string | null }>(
            `/api/v1/campaigns/${encodeURIComponent(id)}/listing-id`,
            options,
          )
        ).listingId;
      },
    ],
  ] as const;
  await Promise.all(
    reads.map(async ([label, read]) => {
      try {
        await read();
      } catch {
        output.errors.push(`${label} belum dapat dimuat.`);
      }
    }),
  );
  return NextResponse.json(output);
}
