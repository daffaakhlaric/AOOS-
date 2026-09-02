import { TopBar } from "@/components/layout/TopBar";
import { LookalikeClient } from "@/components/meta-ads/LookalikeClient";

/** Lookalike Audience page (`/meta-ads/lookalike`, AAOS-ABTESTING-LOOKALIKE Part 2). */
export default function LookalikePage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Lookalike Audience" accentColor="var(--v2-menu-campaigns)" />
      <LookalikeClient />
    </main>
  );
}
