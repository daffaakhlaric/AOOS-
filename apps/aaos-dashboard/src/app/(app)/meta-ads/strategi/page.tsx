import { TopBar } from "@/components/layout/TopBar";
import { StrategiClient } from "@/components/meta-ads/StrategiClient";

/** Strategi & Approve page (spec `meta-ads/strategi/page.tsx`, AAOS-SAMANTHA-PAGES redesign). */
export default function StrategiPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Strategi & Approve" accentColor="var(--v2-menu-campaigns)" />
      <StrategiClient />
    </main>
  );
}
