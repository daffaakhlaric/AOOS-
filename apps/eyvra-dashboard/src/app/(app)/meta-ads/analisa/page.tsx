import { AnalisaClient } from "@/components/meta-ads/AnalisaClient";
import { TopBar } from "@/components/layout/TopBar";

/** Analisa & Rekomendasi page (spec `meta-ads/analisa/page.tsx`, AAOS-SAMANTHA-PAGES redesign). */
export default function AnalisaPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Analisa & Rekomendasi" accentColor="var(--v2-menu-campaigns)" />
      <AnalisaClient />
    </main>
  );
}
