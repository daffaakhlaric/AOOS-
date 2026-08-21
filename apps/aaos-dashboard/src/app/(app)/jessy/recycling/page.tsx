import { TopBar } from "@/components/layout/TopBar";
import { RecyclingClient } from "@/components/jessy/RecyclingClient";

/** `/jessy/recycling` — daur ulang COLD/WARM leads via broadcast promo (AAOS-LEAD-RECYCLING-BROADCAST). */
export default function RecyclingPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Lead Recycling" />
      <RecyclingClient />
    </main>
  );
}
