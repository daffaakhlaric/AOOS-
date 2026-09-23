import { Suspense } from "react";
import { CampaignWorkspace } from "@/components/campaigns/CampaignWorkspace";
export default function Page() {
  return (
    <Suspense fallback={<p>Loading campaign portfolio...</p>}>
      <CampaignWorkspace />
    </Suspense>
  );
}
