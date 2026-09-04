import { CampaignTable } from "@/components/meta-ads/CampaignTable";
import { EmptyState } from "@/components/ui/EmptyState";
import type { OverviewCampaignsSummaryDto } from "@/types/dashboard.types";

/**
 * Overview page's campaign section — REAL DECISION recorded here: reuses the already-built
 * `CampaignTable.tsx` (Analytics Platform Phase 1's virtual-scrolled, tab-structured Campaigns/Ad
 * Sets/Ads table with benchmark-CPL/frequency coloring) directly, rather than building a second,
 * simpler table from the pasted spec's own flat mockup. That component's own docstring records it
 * was built but never wired into any real page — this Overview Monitor section is the first real
 * page to render it. `campaigns.campaigns` (O1's real, structurally-compatible `CampaignSummaryDto`
 * array — see `dashboard.types.ts`'s own doc on this) is handed straight through with zero
 * adapter/mapping code. `vertical="PROPERTY"` is always passed (this section only ever renders on
 * the PROPERTY branch of `DashboardClient.tsx`), enabling `CampaignTable`'s real HOUSING column.
 *
 * No `onExecute` handler wired — this compact overview section is read-only; executing a verdict
 * stays the dedicated `/meta-ads` page's job (same "don't duplicate a write path" discipline as
 * `LeadPipelineSection`/`RecyclingStatusSection`'s own docs).
 */
export function CampaignSection({
  campaigns,
}: {
  readonly campaigns?: OverviewCampaignsSummaryDto;
}): React.ReactElement {
  if (campaigns === undefined) {
    return (
      <EmptyState
        title="Data campaign tidak tersedia"
        description="Pull Meta Ads gagal atau belum pernah dilakukan untuk periode ini."
      />
    );
  }

  return <CampaignTable campaigns={campaigns.campaigns} vertical="PROPERTY" />;
}
