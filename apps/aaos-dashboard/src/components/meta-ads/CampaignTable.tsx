"use client";

import { VerdictBadge } from "@/components/meta-ads/VerdictBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatIdr, formatNumber } from "@/lib/formatters";
import type { CampaignAdDto } from "@/types/dashboard.types";

export interface CampaignTableProps {
  readonly ads: readonly CampaignAdDto[];
  readonly onExecute?: (ad: CampaignAdDto) => void;
}

/** MAAO2-style ad table (spec "meta-ads/page.tsx" mockup: "#A001 Meta-DM-Leads-Mobix · Rp 6.00jt · 790 chat · 307 D3 · Rp19.541/D3 · [REVIEW ▾] [⚡ Execute]"). */
export function CampaignTable({ ads, onExecute }: CampaignTableProps): React.ReactElement {
  if (ads.length === 0) {
    return (
      <EmptyState
        title="Belum ada data iklan"
        description="Tarik data baru untuk melihat kampanye."
      />
    );
  }

  return (
    <ul data-testid="campaign-table" className="flex flex-col gap-2">
      {ads.map((ad) => (
        <li
          key={ad.id}
          className="rounded-card border border-hairline bg-surface-card p-4 shadow-card"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-ink">{ad.name}</p>
              <p className="text-sm text-ink-muted">
                {formatIdr(ad.metrics.spend)} · {formatNumber(ad.metrics.conversations)} chat ·{" "}
                {formatNumber(ad.metrics.d3)} D3
                {ad.metrics.rphD3 !== null ? ` · ${formatIdr(ad.metrics.rphD3)}/D3` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <VerdictBadge verdict={ad.verdict} />
              <button
                type="button"
                onClick={() => onExecute?.(ad)}
                className="rounded-button border border-hairline px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-page"
              >
                ⚡ Execute
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
