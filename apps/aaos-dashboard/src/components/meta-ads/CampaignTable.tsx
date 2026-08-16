"use client";

import { VerdictBadge } from "@/components/meta-ads/VerdictBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { stripAdNameSuffix } from "@/lib/adName";
import { formatIdr, formatNumber } from "@/lib/formatters";
import type { CampaignAdDto } from "@/types/dashboard.types";

import styles from "./CampaignTable.module.css";

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
    <ul data-testid="campaign-table" className={styles.list}>
      {ads.map((ad) => (
        <li key={ad.id} className={styles.row}>
          <div className={styles.top}>
            <div>
              <p className={styles.name}>{stripAdNameSuffix(ad.name)}</p>
              <p className={styles.metrics}>
                {formatIdr(ad.metrics.spend)} · {formatNumber(ad.metrics.conversations)} chat ·{" "}
                {formatNumber(ad.metrics.d3)} D3
                {ad.metrics.rphD3 !== null ? ` · ${formatIdr(ad.metrics.rphD3)}/D3` : ""}
              </p>
            </div>
            <div className={styles.actions}>
              <VerdictBadge verdict={ad.verdict} />
              <button
                type="button"
                onClick={() => onExecute?.(ad)}
                className={styles.executeButton}
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
