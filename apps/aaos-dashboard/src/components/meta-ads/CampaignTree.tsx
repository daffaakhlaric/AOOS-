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

/** Left accent-bar color per aggregated verdict (spec "Data Iklan ... Each campaign = subtle card with left accent color"). Deliberately a small local map, same pattern as `VerdictBadge.tsx` — not a shared token, see that file's docstring. */
function accentBorderColor(verdict: string): string {
  switch (verdict) {
    case "FIX":
    case "PAUSE":
      return "border-l-[#DC2626]";
    case "SCALE":
      return "border-l-[#1A9E5C]";
    case "REFRESH":
      return "border-l-purple-400";
    case "KEEP":
      return "border-l-[#2563EB]";
    default:
      return "border-l-[#D97706]";
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
 * The card-based #A campaign → #B ad-set → #C ad hierarchy (UI-overhaul pass: spec "--- Data
 * Iklan ---" ASCII mockup — subtle card per campaign with a left accent-color bar, an expand/
 * collapse toggle, and an indented Ad Set → Ad hierarchy inside). Every `stableId` shown is the
 * real one `aaos-api` assigned (`@aos/meta-ads-connector`'s `StableIdAssigner`) — never resorted/
 * reassigned here.
 *
 * Data logic and the `onExecute(targetId, targetType, verdict)` callback contract are UNCHANGED
 * from the pre-overhaul version (`aggregateVerdict`'s precedence, `filterCampaigns`'s search
 * semantics) — this pass only restyles the presentation and layers an expand/collapse interaction
 * on top. Every campaign starts EXPANDED (`expanded[id] ?? true`) so Ad Set/Ad rows — and their
 * Execute buttons — are present in the DOM without requiring an extra click, matching the
 * pre-overhaul component's behavior for callers/tests that don't interact with the toggle.
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
    <ul data-testid="campaign-tree" className="flex flex-col gap-3">
      {filtered.map((campaign) => {
        const allAds = campaign.adSets.flatMap((adSet) => adSet.ads);
        const { conversations, d3 } = sumMetrics(allAds);
        const verdict = aggregateVerdict(allAds.map((ad) => ad.verdict));
        const isExpanded = expanded[campaign.id] ?? true;
        const rphD3 = rphD3For(campaign.spend, d3);
        return (
          <li
            key={campaign.id}
            className={`card-hover-lift rounded-card border border-l-4 border-hairline-card bg-surface-card shadow-card ${accentBorderColor(verdict)}`}
          >
            <div className="flex items-start justify-between gap-3 p-4">
              <button
                type="button"
                onClick={() => toggle(campaign.id)}
                aria-expanded={isExpanded}
                className="flex min-w-0 flex-1 items-start gap-2 text-left"
              >
                <span aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted">
                  {isExpanded ? "▾" : "▸"}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">
                    {campaign.stableId} {campaign.name}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {formatIdr(campaign.spend)} · {formatNumber(conversations)} chat ·{" "}
                    {formatNumber(d3)} D3{rphD3 !== null ? ` · ${formatIdr(rphD3)}/D3` : ""} ·{" "}
                    {campaign.adSets.length} AS
                  </p>
                </div>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                <VerdictBadge verdict={verdict} />
                <button
                  type="button"
                  onClick={() => onExecute(campaign.id, "campaign", verdict)}
                  className="btn-press rounded-button border border-hairline-card px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-page"
                >
                  ⚡ Execute
                </button>
              </div>
            </div>
            {isExpanded ? (
              <ul className="flex flex-col gap-2 border-t border-hairline-subtle px-4 pb-4 pt-3">
                {campaign.adSets.map((adSet) => {
                  const { conversations: setConversations, d3: setD3 } = sumMetrics(adSet.ads);
                  return (
                    <li key={adSet.id} className="ml-6">
                      <p className="text-sm font-medium text-ink">
                        {adSet.stableId} {adSet.name}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {formatIdr(adSet.spend)} · {formatNumber(setConversations)} chat ·{" "}
                        {formatNumber(setD3)} D3
                      </p>
                      <ul className="mt-2 flex flex-col gap-2">
                        {adSet.ads.map((ad) => (
                          <li key={ad.id} className="ml-12 flex flex-col gap-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-ink">
                                  {ad.stableId} {stripAdNameSuffix(ad.name)}
                                </p>
                                <p className="text-xs text-ink-muted">
                                  {formatIdr(ad.metrics.spend)} ·{" "}
                                  {formatNumber(ad.metrics.conversations)} chat ·{" "}
                                  {formatNumber(ad.metrics.d3)} D3
                                  {ad.metrics.rphD3 !== null
                                    ? ` · ${formatIdr(ad.metrics.rphD3)}/D3`
                                    : ""}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <VerdictBadge verdict={ad.verdict} />
                                <button
                                  type="button"
                                  onClick={() => onExecute(ad.id, "ad", ad.verdict)}
                                  className="btn-press rounded-button border border-hairline-card px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-page"
                                >
                                  ⚡ Execute
                                </button>
                              </div>
                            </div>
                            <CampaignFunnelBar metrics={ad.metrics} />
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
