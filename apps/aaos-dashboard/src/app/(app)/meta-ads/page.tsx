import { TopBar } from "@/components/layout/TopBar";
import { MetaAdsClient } from "@/components/meta-ads/MetaAdsClient";

/** Meta Ads insight page (spec "meta-ads/page.tsx"). */
export default function MetaAdsPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Data Iklan" accentColor="var(--v2-menu-campaigns)" />
      <MetaAdsClient />
    </main>
  );
}
