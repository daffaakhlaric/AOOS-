"use client";

import { useState } from "react";

import {
  CampaignDetailDrawer,
  type DrawerTarget,
} from "@/components/campaigns/CampaignDetailDrawer";
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

function sumMetrics(
  ads: readonly AdSummaryDto[],
): Pick<AdMetricsDto, "conversations" | "d3" | "totalLead"> {
  return ads.reduce(
    (acc, ad) => ({
      conversations: acc.conversations + ad.metrics.conversations,
      d3: acc.d3 + ad.metrics.d3,
      totalLead: acc.totalLead + ad.metrics.totalLead,
    }),
    { conversations: 0, d3: 0, totalLead: 0 },
  );
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

/**
 * One right-aligned "LABEL / value" column in a card/row header (spec's "BELANJA/CHAT/D3" trio).
 * FIX 3 (campaign-card UI rebuild follow-up): each metric has its own FIXED width (Belanja 100px /
 * Chat 50px / D3 40px, via `variant`) so the same column lines up vertically across campaign/
 * ad-set/ad rows regardless of how many digits each row's own value happens to have — previously
 * every column auto-sized to its own content, so columns drifted out of alignment row to row.
 */
function MetricColumn({
  label,
  value,
  variant,
  accent,
}: {
  readonly label: string;
  readonly value: string;
  readonly variant: "belanja" | "chat" | "d3";
  readonly accent?: boolean;
}): React.ReactElement {
  const widthClass =
    variant === "belanja"
      ? styles.metricColBelanja
      : variant === "chat"
        ? styles.metricColChat
        : styles.metricColD3;
  return (
    <div className={`${styles.metricCol} ${widthClass ?? ""}`}>
      <span className={styles.metricColLabel}>{label}</span>
      <span className={`${styles.metricColValue} ${accent === true ? styles.metricColAccent : ""}`}>
        {value}
      </span>
    </div>
  );
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
 * semantics) — this pass only restyles the presentation.
 *
 * THREE independent collapse levels (FIX 2, campaign-card UI rebuild follow-up):
 *  - campaign → reveals its ad sets (row only, not their ads)
 *  - ad set → reveals its individual ad rows
 *  - ad → reveals ONLY its funnel strip (FIX 4) — the ad's own name/metrics/Execute button are
 *    already visible as soon as its parent ad set is expanded, clicking the ad row just
 *    shows/hides the funnel breakdown beneath it.
 * All three default to COLLAPSED. While a search query is active, a filtered-in campaign/ad set
 * auto-expands by default (`expanded[id] ?? searchActive`) so the row the user searched for is
 * immediately visible instead of hidden behind a still-collapsed parent — manually toggling always
 * wins over this default, since it's stored in the same `expanded`/`expandedAdSets` maps.
 */
export function CampaignTree({
  campaigns,
  search,
  onExecute,
}: CampaignTreeProps): React.ReactElement {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandedAdSets, setExpandedAdSets] = useState<Record<string, boolean>>({});
  const [expandedAds, setExpandedAds] = useState<Record<string, boolean>>({});
  const [drawerState, setDrawerState] = useState<
    | {
        readonly target: DrawerTarget;
        readonly status: string;
        readonly verdict: string;
        readonly adSet: AdSetSummaryDto;
        readonly focusAd: AdSummaryDto | undefined;
      }
    | undefined
  >(undefined);
  const filtered = filterCampaigns(campaigns, search);
  const searchActive = search.trim().length > 0;

  /** Opens the Prompt 11 detail drawer (see `CampaignDetailDrawer`'s own docstring) — reuses this
   * SAME already-loaded `adSet`/`ad` snapshot, no network call. */
  function openAdSetDrawer(adSet: AdSetSummaryDto): void {
    setDrawerState({
      target: { kind: "adset", name: adSet.name, stableId: adSet.stableId },
      status: adSet.status,
      verdict: aggregateVerdict(adSet.ads.map((ad) => ad.verdict)),
      adSet,
      focusAd: undefined,
    });
  }

  function openAdDrawer(adSet: AdSetSummaryDto, ad: AdSummaryDto): void {
    setDrawerState({
      target: { kind: "ad", name: ad.name, stableId: ad.stableId },
      status: ad.status,
      verdict: ad.verdict,
      adSet,
      focusAd: ad,
    });
  }

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

  function toggleCampaign(campaignId: string): void {
    setExpanded((prev) => ({ ...prev, [campaignId]: !(prev[campaignId] ?? false) }));
  }

  function toggleAdSet(adSetId: string): void {
    setExpandedAdSets((prev) => ({ ...prev, [adSetId]: !(prev[adSetId] ?? false) }));
  }

  function toggleAd(adId: string): void {
    setExpandedAds((prev) => ({ ...prev, [adId]: !(prev[adId] ?? false) }));
  }

  return (
    <>
      <ul data-testid="campaign-tree" className={styles.wrapper}>
        {filtered.map((campaign) => {
          const allAds = campaign.adSets.flatMap((adSet) => adSet.ads);
          const { conversations, d3, totalLead } = sumMetrics(allAds);
          const verdict = aggregateVerdict(allAds.map((ad) => ad.verdict));
          const isExpanded = expanded[campaign.id] ?? searchActive;
          return (
            <li key={campaign.id} className={styles.card}>
              <span aria-hidden="true" className={`${styles.accent} ${accentClass(verdict)}`} />
              <div className={styles.header}>
                <button
                  type="button"
                  onClick={() => toggleCampaign(campaign.id)}
                  aria-expanded={isExpanded}
                  className={styles.headerButton}
                >
                  <span aria-hidden="true" className={styles.expandChevron}>
                    {isExpanded ? "▼" : "▶"}
                  </span>
                  <span className={styles.idBadge}>{campaign.stableId}</span>
                  <div className={styles.nameBlock}>
                    <span className={styles.name}>{stripAdNameSuffix(campaign.name)}</span>
                    <p className={styles.metrics}>
                      {campaign.adSets.length} ad set · {formatNumber(totalLead)} lead
                    </p>
                  </div>
                </button>
                <div className={styles.rightSide}>
                  <VerdictBadge verdict={verdict} />
                  <MetricColumn
                    label="Belanja"
                    value={formatIdr(campaign.spend)}
                    variant="belanja"
                  />
                  <MetricColumn label="Chat" value={formatNumber(conversations)} variant="chat" />
                  <MetricColumn label="D3" value={formatNumber(d3)} variant="d3" accent />
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
                    const isAdSetExpanded = expandedAdSets[adSet.id] ?? searchActive;
                    return (
                      <div key={adSet.id} className={styles.adSetRow}>
                        {/* Sibling button + rightSideSmall (not one big button wrapping everything)
                          — same pattern as the campaign header above: a `<button>` can't validly
                          contain another interactive element, and the ad row below needs its own
                          Execute button nested inside its row, so the toggle target stays scoped
                          to just the chevron/id/name/count. */}
                        <div className={styles.adSetHeader}>
                          <button
                            type="button"
                            onClick={() => toggleAdSet(adSet.id)}
                            aria-expanded={isAdSetExpanded}
                            className={styles.headerButton}
                          >
                            <span aria-hidden="true" className={styles.expandChevron}>
                              {isAdSetExpanded ? "▼" : "▶"}
                            </span>
                            <span className={`${styles.idBadge} ${styles.idBadgeSmall}`}>
                              {adSet.stableId}
                            </span>
                            <span className={styles.adSetName}>
                              {stripAdNameSuffix(adSet.name)}
                            </span>
                            <span className={styles.adSetCount}>{adSet.ads.length} iklan</span>
                          </button>
                          <div className={styles.rightSideSmall}>
                            <MetricColumn
                              label="Belanja"
                              value={formatIdr(adSet.spend)}
                              variant="belanja"
                            />
                            <MetricColumn
                              label="Chat"
                              value={formatNumber(setConversations)}
                              variant="chat"
                            />
                            <MetricColumn
                              label="D3"
                              value={formatNumber(setD3)}
                              variant="d3"
                              accent
                            />
                            <button
                              type="button"
                              data-testid={`open-drawer-adset-${adSet.id}`}
                              onClick={() => openAdSetDrawer(adSet)}
                              className={styles.detailButton}
                            >
                              Detail
                            </button>
                          </div>
                        </div>
                        {isAdSetExpanded ? (
                          <div className={styles.adList}>
                            {adSet.ads.map((ad) => {
                              const isAdExpanded = expandedAds[ad.id] ?? false;
                              return (
                                <div key={ad.id} className={styles.adRow}>
                                  <div className={styles.adTopRow}>
                                    <button
                                      type="button"
                                      onClick={() => toggleAd(ad.id)}
                                      aria-expanded={isAdExpanded}
                                      className={styles.headerButton}
                                    >
                                      <span aria-hidden="true" className={styles.expandChevron}>
                                        {isAdExpanded ? "▼" : "▶"}
                                      </span>
                                      <span className={`${styles.idBadge} ${styles.idBadgeSmall}`}>
                                        {ad.stableId}
                                      </span>
                                      <span className={styles.adName}>
                                        {stripAdNameSuffix(ad.name)}
                                      </span>
                                    </button>
                                    <VerdictBadge verdict={ad.verdict} />
                                    <div className={styles.rightSideSmall}>
                                      <MetricColumn
                                        label="Belanja"
                                        value={formatIdr(ad.metrics.spend)}
                                        variant="belanja"
                                      />
                                      <MetricColumn
                                        label="Chat"
                                        value={formatNumber(ad.metrics.conversations)}
                                        variant="chat"
                                      />
                                      <MetricColumn
                                        label="D3"
                                        value={formatNumber(ad.metrics.d3)}
                                        variant="d3"
                                        accent
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      data-testid={`open-drawer-ad-${ad.id}`}
                                      onClick={() => openAdDrawer(adSet, ad)}
                                      className={styles.detailButton}
                                    >
                                      Detail
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onExecute(ad.id, "ad", ad.verdict)}
                                      className={`${styles.executeButton} ${styles.executeButtonSmall}`}
                                    >
                                      ⚡ Execute
                                    </button>
                                  </div>
                                  {isAdExpanded ? <CampaignFunnelBar metrics={ad.metrics} /> : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {drawerState !== undefined ? (
        <CampaignDetailDrawer
          target={drawerState.target}
          status={drawerState.status}
          verdict={drawerState.verdict}
          adSet={drawerState.adSet}
          focusAd={drawerState.focusAd}
          onClose={() => setDrawerState(undefined)}
        />
      ) : null}
    </>
  );
}
