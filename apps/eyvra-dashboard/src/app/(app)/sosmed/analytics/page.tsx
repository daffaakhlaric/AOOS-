import { TopBar } from "@/components/layout/TopBar";
import { AnalyticsSosmedClient } from "@/components/sosmed/AnalyticsSosmedClient";

/** `/sosmed/analytics` — Analytics Sosmed (AAOS-SOSMED-AUTOMATION Phase 5, Page 5). */
export default function AnalyticsSosmedPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Analytics Sosmed" />
      <AnalyticsSosmedClient />
    </main>
  );
}
