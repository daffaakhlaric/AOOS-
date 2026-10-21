import { Suspense } from "react";
import { CampaignBuilderPage } from "@/components/campaign-builder/CampaignBuilderPage";
export default function Page() {
  return (
    <Suspense fallback={<p>Menyiapkan Campaign Builder…</p>}>
      <CampaignBuilderPage />
    </Suspense>
  );
}
