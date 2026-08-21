import { TopBar } from "@/components/layout/TopBar";
import { AbTestingClient } from "@/components/meta-ads/AbTestingClient";

/** A/B Testing page (`/meta-ads/abtesting`, AAOS-ABTESTING-LOOKALIKE). */
export default function AbTestingPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="A/B Testing" />
      <AbTestingClient />
    </main>
  );
}
