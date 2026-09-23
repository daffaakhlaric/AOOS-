import { Suspense } from "react";
import { CampaignWorkspace } from "@/components/campaigns/CampaignWorkspace";
export default function Page({ params }: { params: { campaignId: string } }) {
  return (
    <Suspense fallback={<p>Loading campaign...</p>}>
      <CampaignWorkspace campaignId={params.campaignId} />
    </Suspense>
  );
}
