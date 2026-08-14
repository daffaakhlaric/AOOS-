import { TopBar } from "@/components/layout/TopBar";
import { SimulasiClient } from "@/components/meta-ads/SimulasiClient";

/** Simulasi Tamara × Kai page (spec `meta-ads/simulasi/page.tsx`, AAOS-TAMARA-PAGES redesign). */
export default function SimulasiPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Simulasi Tamara × Kai" />
      <SimulasiClient />
    </main>
  );
}
