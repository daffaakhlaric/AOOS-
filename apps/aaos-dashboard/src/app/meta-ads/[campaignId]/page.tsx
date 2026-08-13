import { CampaignDetailClient } from "@/components/meta-ads/CampaignDetailClient";
import { TopBar } from "@/components/layout/TopBar";

/** Campaign detail page (spec "meta-ads/[campaignId]/page.tsx"). */
export default function CampaignDetailPage({
  params,
}: {
  readonly params: { readonly campaignId: string };
}): React.ReactElement {
  return (
    <main>
      <TopBar title="Detail Iklan" />
      <CampaignDetailClient campaignId={params.campaignId} />
    </main>
  );
}
