import { TopBar } from "@/components/layout/TopBar";
import { StrategiClient } from "@/components/meta-ads/StrategiClient";

/** Strategi & Approve page (spec `meta-ads/strategi/page.tsx`, AAOS-TAMARA-PAGES redesign). */
export default function StrategiPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Strategi & Approve" />
      <StrategiClient />
    </main>
  );
}
