"use client";

import { useState } from "react";

import { CampaignFunnelBar } from "@/components/meta-ads/CampaignFunnelBar";
import { VerdictBadge } from "@/components/meta-ads/VerdictBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { stripAdNameSuffix } from "@/lib/adName";
import { formatIdr, formatNumber } from "@/lib/formatters";
import type {
  AdMetricsDto,
  AdSetSummaryDto,
  AdSummaryDto,
  CampaignSummaryDto,
} from "@/types/dashboard.types";

import styles from "./CampaignTree.module.css";

/**
 * Highest-priority verdict, mirroring `VerdictEngine`'s own documented precedence (FIX > PAUSE >
 * SCALE > REFRESH > KEEP > REVIEW — `packages/meta-ads-connector/src/domain/services/
 * VerdictEngine.ts`). `aaos-api` only computes `verdict` per-*ad* — campaigns/ad-sets have no
 * verdict of their own — so this is how the campaign/ad-set rows above them pick a single
 * representative badge/Execute target: by picking the most-severe REAL verdict already present
 * among their descendant ads, never by recomputing thresholds from raw spend/d3 numbers itself
 * (that would risk drifting from the real, authoritative `VerdictEngine` computation).
 */
const VERDICT_PRIORITY = ["FIX", "PAUSE", "SCALE", "REFRESH", "KEEP", "REVIEW"] as const;

export function aggregateVerdict(verdicts: readonly string[]): string {
  for (const candidate of VERDICT_PRIORITY) {
    if (verdicts.includes(candidate)) {
      return candidate;
    }
  }
  return verdicts[0] ?? "REVIEW";
}

/** Left accent-bar color per aggregated verdict (spec "=== CAMPAIGN CARDS === Left accent"). */
// `?? ""` resolves the `noUncheckedIndexedAccess` type-only gap on CSS Module property access —
// see VerdictBadge.tsx's docstring for the full explanation.
function accentClass(verdict: string): string {
  switch (verdict) {
    case "FIX":
    case "PAUSE":
      return styles.accentPause ?? "";
    case "SCALE":
      return styles.accentScale ?? "";
    case "REFRESH":
      return styles.accentRefresh ?? "";
    case "KEEP":
      return styles.accentKeep ?? "";
    default:
      return styles.accentReview ?? "";
  }
}

function sumMetrics(ads: readonly AdSummaryDto[]): Pick<AdMetricsDto, "conversations" | "d3"> {
  return ads.reduce(
    (acc, ad) => ({
      conversations: acc.conversations + ad.metrics.conversations,
      d3: acc.d3 + ad.metrics.d3,
    }),
    { conversations: 0, d3: 0 },
  );
}

function rphD3For(spend: number, d3: number): number | null {
  return d3 > 0 ? spend / d3 : null;
}

function matches(name: string, query: string): boolean {
  return name.toLowerCase().includes(query);
}

/** Keeps only ads/ad-sets/campaigns matching `query` (case-insensitive substring on name at any level) — a campaign/ad-set/ad matching by its OWN name keeps all its descendants, since the user searched for that container. */
function filterCampaigns(
  campaigns: readonly CampaignSummaryDto[],
  query: string,
): readonly CampaignSummaryDto[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) {
    return campaigns;
  }
  return campaigns
    .map((campaign): CampaignSummaryDto | undefined => {
      if (matches(campaign.name, trimmed)) {
        return campaign;
      }
      const adSets = campaign.adSets
        .map((adSet): AdSetSummaryDto | undefined => {
          if (matches(adSet.name, trimmed)) {
            return adSet;
          }
          const ads = adSet.ads.filter((ad) => matches(ad.name, trimmed));
          return ads.length > 0 ? { ...adSet, ads } : undefined;
        })
        .filter((adSet): adSet is AdSetSummaryDto => adSet !== undefined);
      return adSets.length > 0 ? { ...campaign, adSets } : undefined;
    })
    .filter((campaign): campaign is CampaignSummaryDto => campaign !== undefined);
}

export interface CampaignTreeProps {
  readonly campaigns: readonly CampaignSummaryDto[];
  readonly search: string;
  readonly onExecute: (
    targetId: string,
    targetType: "ad" | "adset" | "campaign",
    verdict: string,
  ) => void;
}

/**
 * The card-based #A campaign → #B ad-set → #C ad hierarchy (TOTAL UI REBUILD spec "=== CAMPAIGN
 * CARDS ===" / "=== AD SET LEVEL (#B001) ===" / "=== AD LEVEL (#C001) ===" — subtle card per
 * campaign with a left accent-color bar, an expand/collapse chevron, and an indented Ad Set → Ad
 * hierarchy inside, all restyled from Tailwind utilities to `CampaignTree.module.css`). Every
 * `stableId` shown is the real one `aaos-api` assigned (`@aos/meta-ads-connector`'s
 * `StableIdAssigner`) — never resorted/reassigned here.
 *
 * Data logic and the `onExecute(targetId, targetType, verdict)` callback contract are UNCHANGED
 * from the pre-rebuild version (`aggregateVerdict`'s precedence, `filterCampaigns`'s search
 * semantics) — this pass only restyles the presentation. Every campaign starts EXPANDED
 * (`expanded[id] ?? true`) so Ad Set/Ad rows — and their Execute buttons — are present in the DOM
 * without requiring an extra click, matching the pre-rebuild component's behavior for callers/
 * tests that don't interact with the toggle.
 */
export function CampaignTree({
  campaigns,
  search,
  onExecute,
}: CampaignTreeProps): React.ReactElement {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const filtered = filterCampaigns(campaigns, search);

  if (filtered.length === 0) {
    return (
      <EmptyState
        title={search.trim().length > 0 ? "Tidak ada hasil" : "Belum ada data iklan"}
        description={
          search.trim().length > 0
            ? "Coba kata kunci lain."
            : "Tarik data baru untuk melihat kampanye."
        }
      />
    );
  }

  function toggle(campaignId: string): void {
    setExpanded((prev) => ({ ...prev, [campaignId]: !(prev[campaignId] ?? true) }));
  }

  return (
    <ul data-testid="campaign-tree" className={styles.wrapper}>
      {filtered.map((campaign) => {
        const allAds = campaign.adSets.flatMap((adSet) => adSet.ads);
        const { conversations, d3 } = sumMetrics(allAds);
        const verdict = aggregateVerdict(allAds.map((ad) => ad.verdict));
        const isExpanded = expanded[campaign.id] ?? true;
        const rphD3 = rphD3For(campaign.spend, d3);
        return (
          <li key={campaign.id} className={styles.card}>
            <span aria-hidden="true" className={`${styles.accent} ${accentClass(verdict)}`} />
            <div className={styles.header}>
              <button
                type="button"
                onClick={() => toggle(campaign.id)}
                aria-expanded={isExpanded}
                className={styles.headerButton}
              >
                <span
                  aria-hidden="true"
                  className={`${styles.expandChevron} ${isExpanded ? styles.expandChevronOpen : ""}`}
                >
                  ▸
                </span>
                <div className={styles.nameBlock}>
                  <span className={styles.idBadge}>{campaign.stableId}</span>{" "}
                  <span className={styles.name}>{campaign.name}</span>
                  <p className={styles.metrics}>
                    {formatIdr(campaign.spend)} · {formatNumber(conversations)} chat ·{" "}
                    {formatNumber(d3)} D3{rphD3 !== null ? ` · ${formatIdr(rphD3)}/D3` : ""} ·{" "}
                    {campaign.adSets.length} AS
                  </p>
                </div>
              </button>
              <div className={styles.rightSide}>
                <VerdictBadge verdict={verdict} />
                <button
                  type="button"
                  onClick={() => onExecute(campaign.id, "campaign", verdict)}
                  className={styles.executeButton}
                >
                  ⚡ Execute
                </button>
              </div>
            </div>
            {isExpanded ? (
              <div className={styles.adSetContainer}>
                {campaign.adSets.map((adSet) => {
                  const { conversations: setConversations, d3: setD3 } = sumMetrics(adSet.ads);
                  return (
                    <div key={adSet.id} className={styles.adSetRow}>
                      <div className={styles.adSetHeader}>
                        <span className={`${styles.idBadge} ${styles.idBadgeSmall}`}>
                          {adSet.stableId}
                        </span>
                        <span className={styles.adSetName}>{adSet.name}</span>
                      </div>
                      <p className={styles.adSetMetrics}>
                        {formatIdr(adSet.spend)} · {formatNumber(setConversations)} chat ·{" "}
                        {formatNumber(setD3)} D3
                      </p>
                      <div className={styles.adList}>
                        {adSet.ads.map((ad) => (
                          <div key={ad.id} className={styles.adRow}>
                            <div className={styles.adTopRow}>
                              <span className={`${styles.idBadge} ${styles.idBadgeSmall}`}>
                                {ad.stableId}
                              </span>
                              <span className={styles.adName}>{stripAdNameSuffix(ad.name)}</span>
                              <VerdictBadge verdict={ad.verdict} />
                              <button
                                type="button"
                                onClick={() => onExecute(ad.id, "ad", ad.verdict)}
                                className={`${styles.executeButton} ${styles.executeButtonSmall}`}
                              >
                                ⚡ Execute
                              </button>
                            </div>
                            <CampaignFunnelBar metrics={ad.metrics} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
