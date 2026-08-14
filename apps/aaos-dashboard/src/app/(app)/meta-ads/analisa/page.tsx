import { AnalisaClient } from "@/components/meta-ads/AnalisaClient";
import { TopBar } from "@/components/layout/TopBar";

/** Analisa & Rekomendasi page (spec `meta-ads/analisa/page.tsx`, AAOS-TAMARA-PAGES redesign). */
export default function AnalisaPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Analisa & Rekomendasi" />
      <AnalisaClient />
    </main>
  );
}
