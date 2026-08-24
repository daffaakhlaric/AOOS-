import { TopBar } from "@/components/layout/TopBar";
import { DashboardSosmedClient } from "@/components/sosmed/DashboardSosmedClient";

/** `/sosmed` — Dashboard Sosmed (AAOS-SOSMED-AUTOMATION Phase 5, Page 1). */
export default function SosmedDashboardPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Dashboard Sosmed" />
      <DashboardSosmedClient />
    </main>
  );
}
