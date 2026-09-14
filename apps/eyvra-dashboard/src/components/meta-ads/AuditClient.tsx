"use client";

import { VerdictBadge } from "@/components/meta-ads/VerdictBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import { stripAdNameSuffix } from "@/lib/adName";
import { formatDateTimeIdWib, formatIdr, formatIdrCompact, formatNumber } from "@/lib/formatters";
import { useCampaignsSnapshot } from "@/lib/useCampaignsSnapshot";
import type {
  AdAccountSummaryDto,
  CampaignAdDto,
  CampaignSummaryDto,
} from "@/types/dashboard.types";

import styles from "./AuditClient.module.css";

/** DSS Motor's real funnel labels — `Funnel` enum (`@aos/meta-ads-connector`), Indonesian display labels for this page's grouping (spec Section 2, adapted to coordinator note #1: group by the real `ad.funnel` field, never a second classifier). */
const FUNNEL_LABELS: Readonly<Record<string, string>> = {
  BRAND_BOOST: "Brand/Boost",
  DM: "DM Multi-channel",
  CTWA: "CTWA",
  WEBSITE_LEAD: "Website Lead (LP)",
};

const RP_PER_CHAT_GREEN_MAX = 15_000;
const RP_PER_CHAT_THRESHOLD = 25_000;
const FREQUENCY_THRESHOLD = 3.5;
const NEW_AD_MAX_DAYS = 14;
const OUTCOME_LEADS = "OUTCOME_LEADS";
const SALAH_TUJUAN_MAX_SHOWN = 5;

/**
 * Branch color dots — reuses the exact real bucketing convention `CabangSourceClient.tsx`
 * already established (CINERE/BINTARO/BANDUNG get a named color; everything else — BOOST/MULTI/
 * JABODETABEK/UMUM — shares one neutral color), rather than inventing a parallel one. The task's
 * spec named a 4th color for a "Pondok Bambu" branch, but the real `BranchExtractor.ts` classifier
 * has no rule that ever produces it (only Cinere/Bintaro/Bandung/"boost"/"multi" are matched,
 * everything else falls to `UMUM`) — so no ad this page ever sees can legitimately be labeled
 * "Pondok Bambu", and inventing a color/bucket for a value that can't occur would be presentational
 * fabrication, not real grouping.
 */
const BRANCH_COLOR: Readonly<Record<string, "blue" | "green" | "amber">> = {
  BINTARO: "blue",
  CINERE: "green",
  BANDUNG: "amber",
};

function branchColorClass(branch: string): string {
  const color = BRANCH_COLOR[branch];
  if (color === "blue") return styles.dotBlue ?? "";
  if (color === "green") return styles.dotGreen ?? "";
  if (color === "amber") return styles.dotAmber ?? "";
  return styles.dotGray ?? "";
}

/** Same per-branch color as `branchColorClass`, but the `.barFill` variant — kept as its own
 * lookup (not a string transform of `branchColorClass`'s result) since CSS Modules class names
 * are opaque hashed strings, not literal "dot..."/"bar..." text to search-and-replace. */
function branchBarClass(branch: string): string {
  const color = BRANCH_COLOR[branch];
  if (color === "blue") return styles.barBlue ?? "";
  if (color === "green") return styles.barGreen ?? "";
  if (color === "amber") return styles.barAmber ?? "";
  return styles.barGray ?? "";
}

type RpChatTier = "green" | "amber" | "red" | "neutral";

/** Rp/chat 3-tier coloring (spec "Rp/chat colors: green<15rb, amber<25rb, red>=25rb"), reused for
 * both the Belanja per Funnel bar/text and the KPI strip's Rp/Chat cell. */
function rpChatTier(rpChat: number | null): RpChatTier {
  if (rpChat === null) return "neutral";
  if (rpChat < RP_PER_CHAT_GREEN_MAX) return "green";
  if (rpChat < RP_PER_CHAT_THRESHOLD) return "amber";
  return "red";
}

function tierTextClass(tier: RpChatTier): string {
  if (tier === "green") return styles.textGreen ?? "";
  if (tier === "amber") return styles.textAmber ?? "";
  if (tier === "red") return styles.textRed ?? "";
  return "";
}

function tierBarClass(tier: RpChatTier): string {
  if (tier === "green") return styles.barGreen ?? "";
  if (tier === "amber") return styles.barAmber ?? "";
  if (tier === "red") return styles.barRed ?? "";
  return styles.barGray ?? "";
}

const STATUS_TONE: Readonly<Record<string, StatusTone>> = {
  ACTIVE: "success",
  PAUSED: "neutral",
  ARCHIVED: "neutral",
  DELETED: "danger",
};

interface AdWithObjective {
  readonly ad: CampaignAdDto;
  readonly campaignObjective: string;
}

/** Walks `data.campaigns` to pair every ad with its parent campaign's real `objective` — `CampaignAdDto` (the flat `data.ads` list) has no `objective` field of its own, only `campaignName`, so this is the only real source for the "salah tujuan" check. */
function flattenWithObjective(data: AdAccountSummaryDto): readonly AdWithObjective[] {
  const result: AdWithObjective[] = [];
  for (const campaign of data.campaigns) {
    for (const adSet of campaign.adSets) {
      for (const ad of adSet.ads) {
        result.push({
          campaignObjective: campaign.objective,
          ad: {
            id: ad.id,
            metaId: ad.metaId,
            stableId: ad.stableId,
            name: ad.name,
            campaignName: campaign.name,
            status: ad.status,
            funnel: ad.funnel,
            branch: ad.branch,
            verdict: ad.verdict,
            metrics: ad.metrics,
            ...(ad.daysSinceCreation !== undefined
              ? { daysSinceCreation: ad.daysSinceCreation }
              : {}),
          },
        });
      }
    }
  }
  return result;
}

function rpPerChat(spend: number, conversations: number): number | null {
  return conversations > 0 ? spend / conversations : null;
}

/** Every ad under one campaign inherits that campaign's `funnel` (`AdMapper`'s real mapping rule
 * — see this file's `FUNNEL_LABELS` docstring), so peeking at the first ad found is enough to
 * know the whole campaign's funnel; a campaign with zero ads yet contributes no funnel. */
function campaignFunnel(campaign: CampaignSummaryDto): string | undefined {
  for (const adSet of campaign.adSets) {
    const firstAd = adSet.ads[0];
    if (firstAd !== undefined) {
      return firstAd.funnel;
    }
  }
  return undefined;
}

interface FunnelGroup {
  readonly funnel: string;
  readonly spend: number;
  readonly conversations: number;
  readonly campaignCount: number;
}

function groupByFunnel(data: AdAccountSummaryDto): readonly FunnelGroup[] {
  const totals = new Map<string, { spend: number; conversations: number }>();
  for (const ad of data.ads) {
    const current = totals.get(ad.funnel) ?? { spend: 0, conversations: 0 };
    totals.set(ad.funnel, {
      spend: current.spend + ad.metrics.spend,
      conversations: current.conversations + ad.metrics.conversations,
    });
  }
  const campaignCounts = new Map<string, number>();
  for (const campaign of data.campaigns) {
    const funnel = campaignFunnel(campaign);
    if (funnel === undefined) {
      continue;
    }
    campaignCounts.set(funnel, (campaignCounts.get(funnel) ?? 0) + 1);
  }
  return [...totals.entries()]
    .map(([funnel, group]) => ({
      funnel,
      ...group,
      campaignCount: campaignCounts.get(funnel) ?? 0,
    }))
    .sort((a, b) => b.spend - a.spend);
}

interface BranchGroup {
  readonly branch: string;
  readonly spend: number;
  readonly adCount: number;
}

function groupByBranch(ads: readonly CampaignAdDto[]): readonly BranchGroup[] {
  const groups = new Map<string, { spend: number; adCount: number }>();
  for (const ad of ads) {
    const current = groups.get(ad.branch) ?? { spend: 0, adCount: 0 };
    groups.set(ad.branch, {
      spend: current.spend + ad.metrics.spend,
      adCount: current.adCount + 1,
    });
  }
  return [...groups.entries()]
    .map(([branch, totals]) => ({ branch, ...totals }))
    .sort((a, b) => b.spend - a.spend);
}

/** `N iklan` / `Tidak ada` count suffix — spec's own literal wording for the waste sub-section headers. */
function countSuffix(count: number): string {
  return count === 0 ? "Tidak ada" : `${formatNumber(count)} iklan`;
}

/**
 * "Audit Biaya" page (spec `meta-ads/audit/page.tsx`) — belanja per funnel/cabang, waste
 * detection, and new-ad tracking, all read from the SAME cached snapshot `/meta-ads`'s "Data
 * Iklan" page pulls (coordinator note #7). Never fetches on mount; a "🔄 Tarik data baru" button
 * force-pulls fresh data, matching `MetaAdsClient.tsx`'s house style (coordinator note #7).
 *
 * Coordinator note #1: funnel/branch grouping reuses the real `ad.funnel`/`ad.branch` fields
 * `aaos-api` already computed (`FunnelClassifier`/`BranchExtractor`) — this page never runs its
 * own classifier, so it can never disagree with "Data Iklan" about which funnel/branch an ad
 * belongs to. A later UI-rebuild pass proposed re-deriving funnel client-side from `objective` +
 * a Meta `destination_type` field — `destination_type` isn't a real field on any `CampaignAdDto`/
 * `AdSummaryDto`, and the existing single-source-of-truth reasoning above still holds, so that
 * part of the spec was NOT implemented; the real `ad.funnel` grouping stayed as-is.
 *
 * "Salah tujuan"/"Rp/chat mahal" rows show each ad's REAL verdict badge (`VerdictBadge`), not a
 * hardcoded "FIX"/"PAUSE" label — `VerdictEngine.ts` already makes `objective !== OUTCOME_LEADS`
 * unconditionally produce `FIX` (highest precedence, no exceptions) and its `PAUSE` threshold
 * (Rp/chat > 22.000) is stricter than this page's own "mahal" threshold (25.000), so both sections
 * show FIX/PAUSE in the normal case anyway — but showing the real field instead of a literal
 * string means this can never silently drift from what "Data Iklan"'s own badges say.
 */
export function AuditClient(): React.ReactElement {
  const { data, fetchedAt, period, loading, error, pull } = useCampaignsSnapshot();

  if (data === undefined) {
    return (
      <div className={styles.page}>
        <Header onPull={() => void pull()} loading={loading} />
        {loading ? <LoadingSpinner /> : null}
        {!loading && error !== undefined ? <ErrorCard message={error} /> : null}
        {!loading && error === undefined ? (
          <EmptyState
            title="Belum ada data"
            description="Tarik data di halaman Data Iklan terlebih dahulu."
          />
        ) : null}
      </div>
    );
  }

  const withObjective = flattenWithObjective(data);
  const funnelGroups = groupByFunnel(data);
  const branchGroups = groupByBranch(data.ads);
  const adSetCount = data.campaigns.reduce((sum, campaign) => sum + campaign.adSets.length, 0);
  const totalRpPerChat = rpPerChat(data.totals.spend, data.totals.conversations);
  const totalRpChatTier = rpChatTier(totalRpPerChat);

  const salahTujuan = withObjective.filter((entry) => entry.campaignObjective !== OUTCOME_LEADS);
  const audiensJenuh = data.ads.filter((ad) => ad.metrics.frequency >= FREQUENCY_THRESHOLD);
  const rpChatMahal = data.ads
    .map((ad) => ({ ad, rpChat: rpPerChat(ad.metrics.spend, ad.metrics.conversations) }))
    .filter(
      (entry): entry is { ad: CampaignAdDto; rpChat: number } =>
        entry.rpChat !== null && entry.rpChat > RP_PER_CHAT_THRESHOLD,
    )
    .sort((a, b) => b.rpChat - a.rpChat);
  const iklanBaru = data.ads
    .filter(
      (ad): ad is CampaignAdDto & { daysSinceCreation: number } =>
        ad.daysSinceCreation !== undefined && ad.daysSinceCreation <= NEW_AD_MAX_DAYS,
    )
    .sort((a, b) => a.daysSinceCreation - b.daysSinceCreation);

  const maxFunnelSpend = Math.max(1, ...funnelGroups.map((group) => group.spend));
  const maxBranchSpend = Math.max(1, ...branchGroups.map((group) => group.spend));
  const shownSalahTujuan = salahTujuan.slice(0, SALAH_TUJUAN_MAX_SHOWN);
  const hiddenSalahTujuanCount = salahTujuan.length - shownSalahTujuan.length;

  return (
    <div className={styles.page}>
      <Header onPull={() => void pull()} loading={loading} />
      {fetchedAt !== undefined ? (
        <p data-testid="audit-last-updated" className={styles.lastUpdated}>
          🕒 Data diambil: {formatDateTimeIdWib(new Date(fetchedAt).toISOString())} · periode{" "}
          {period}
        </p>
      ) : null}
      {error !== undefined ? <ErrorCard message={error} /> : null}

      <section data-testid="audit-kpi-bar" className={styles.kpiBar}>
        <Kpi label="Total Belanja" value={formatIdrCompact(data.totals.spend)} />
        <Kpi label="Total Chat" value={formatNumber(data.totals.conversations)} />
        <Kpi
          label="Rp/Chat"
          value={totalRpPerChat !== null ? formatIdr(totalRpPerChat) : "—"}
          accentClass={totalRpChatTier === "red" ? styles.kpiValueAmber : ""}
        />
        <Kpi label="Kampanye" value={formatNumber(data.campaignCount)} />
        <Kpi label="Ad Set" value={formatNumber(adSetCount)} />
        <Kpi label="Iklan" value={formatNumber(data.adCount)} />
      </section>

      <section data-testid="audit-funnel-section" className={styles.section}>
        <h3 className={styles.sectionTitle}>💸 Belanja per Funnel</h3>
        {funnelGroups.length === 0 ? (
          <p className={styles.mutedText}>Tidak ada data funnel.</p>
        ) : (
          <div className={styles.card}>
            <ul className={styles.barList}>
              {funnelGroups.map((group) => {
                const perChat = rpPerChat(group.spend, group.conversations);
                const tier = rpChatTier(perChat);
                const widthPct = Math.round((group.spend / maxFunnelSpend) * 100);
                return (
                  <li key={group.funnel} className={styles.barRow}>
                    <div className={styles.barRowTop}>
                      <span className={styles.barRowName}>
                        {FUNNEL_LABELS[group.funnel] ?? group.funnel}
                      </span>
                      <span className={styles.barRowCount}>
                        {formatNumber(group.campaignCount)} kampanye
                      </span>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={`${styles.barFill} ${tierBarClass(tier)}`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <p className={styles.barRowMeta}>
                      {formatIdr(group.spend)} · {formatNumber(group.conversations)} chat
                      {perChat !== null ? (
                        <>
                          {" · "}
                          <span className={tierTextClass(tier)}>{formatIdr(perChat)}/chat</span>
                        </>
                      ) : null}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <section data-testid="audit-branch-section" className={styles.section}>
        <h3 className={styles.sectionTitle}>🏢 Belanja per Cabang</h3>
        {branchGroups.length === 0 ? (
          <p className={styles.mutedText}>Tidak ada data cabang.</p>
        ) : (
          <div className={styles.card}>
            <ul className={styles.barList}>
              {branchGroups.map((group) => {
                const widthPct = Math.round((group.spend / maxBranchSpend) * 100);
                return (
                  <li key={group.branch} className={styles.barRow}>
                    <div className={styles.barRowTop}>
                      <span className={styles.barRowName}>
                        <span
                          aria-hidden="true"
                          className={`${styles.dot} ${branchColorClass(group.branch)}`}
                        />
                        {group.branch}
                      </span>
                      <span className={styles.barRowCount}>
                        {formatNumber(group.adCount)} iklan
                      </span>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={`${styles.barFill} ${branchBarClass(group.branch)}`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <p className={styles.barRowSpend}>{formatIdr(group.spend)}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <section data-testid="audit-waste-section" className={styles.section}>
        <h3 className={styles.sectionTitle}>🚨 Deteksi Pemborosan</h3>
        <div className={styles.card}>
          <div className={`${styles.wasteBlock} ${styles.wasteBlockAmber}`}>
            <p className={styles.wasteLabel}>
              🎯 Salah tujuan (objective ≠ OUTCOME_LEADS) · {countSuffix(salahTujuan.length)}
            </p>
            {salahTujuan.length > 0 ? (
              <ul className={styles.wasteList}>
                {shownSalahTujuan.map((entry) => {
                  const perChat = rpPerChat(entry.ad.metrics.spend, entry.ad.metrics.conversations);
                  return (
                    <li key={entry.ad.id} className={styles.wasteItem}>
                      <VerdictBadge verdict={entry.ad.verdict} />
                      <span className={styles.idBadge}>{entry.ad.stableId}</span>
                      <span className={styles.wasteItemName}>
                        {stripAdNameSuffix(entry.ad.name)}
                      </span>
                      <span className={styles.wasteItemValue}>
                        {perChat !== null ? formatIdr(perChat) : "—"}/chat
                      </span>
                    </li>
                  );
                })}
                {hiddenSalahTujuanCount > 0 ? (
                  <li className={styles.wasteItemMore}>+ {hiddenSalahTujuanCount} lainnya</li>
                ) : null}
              </ul>
            ) : null}
          </div>

          <div className={`${styles.wasteBlock} ${styles.wasteBlockRed}`}>
            <p className={styles.wasteLabel}>
              💸 Rp/chat terlalu mahal (&gt; {formatIdr(RP_PER_CHAT_THRESHOLD)}) ·{" "}
              {countSuffix(rpChatMahal.length)}
            </p>
            {rpChatMahal.length > 0 ? (
              <ul className={styles.wasteList}>
                {rpChatMahal.map(({ ad, rpChat }) => (
                  <li key={ad.id} className={styles.wasteItem}>
                    <VerdictBadge verdict={ad.verdict} />
                    <span className={styles.idBadge}>{ad.stableId}</span>
                    <span className={styles.wasteItemName}>{stripAdNameSuffix(ad.name)}</span>
                    <span className={`${styles.wasteItemValue} ${styles.textRed}`}>
                      {formatIdr(rpChat)}/chat
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className={`${styles.wasteBlock} ${styles.wasteBlockGray}`}>
            <p className={styles.wasteLabel}>
              🔁 Audiens jenuh (frequency ≥ {FREQUENCY_THRESHOLD}) ·{" "}
              {countSuffix(audiensJenuh.length)}
            </p>
            {audiensJenuh.length > 0 ? (
              <ul className={styles.wasteList}>
                {audiensJenuh.map((ad) => (
                  <li key={ad.id} className={styles.wasteItem}>
                    <span className={styles.idBadge}>{ad.stableId}</span>
                    <span className={styles.wasteItemName}>{stripAdNameSuffix(ad.name)}</span>
                    <span className={styles.wasteItemValue}>
                      frequency {ad.metrics.frequency.toFixed(1)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </section>

      <section data-testid="audit-new-ads-section" className={styles.section}>
        <h3 className={styles.sectionTitle}>🆕 Iklan Baru ({NEW_AD_MAX_DAYS} hari terakhir)</h3>
        {iklanBaru.length === 0 ? (
          <p className={styles.mutedText}>Tidak ada iklan baru.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHeadRow}>
                  <th>#</th>
                  <th>Iklan</th>
                  <th>Cabang</th>
                  <th>Status</th>
                  <th>Belanja</th>
                  <th>Dibuat</th>
                </tr>
              </thead>
              <tbody>
                {iklanBaru.map((ad) => (
                  <tr key={ad.id} className={styles.tableRow}>
                    <td className={`${styles.tableCell} ${styles.tableCellMono}`}>{ad.stableId}</td>
                    <td className={`${styles.tableCell} ${styles.tableCellStrong}`}>
                      {stripAdNameSuffix(ad.name)}
                    </td>
                    <td className={`${styles.tableCell} ${styles.tableCellMuted}`}>{ad.branch}</td>
                    <td className={styles.tableCell}>
                      <StatusBadge label={ad.status} tone={STATUS_TONE[ad.status] ?? "neutral"} />
                    </td>
                    <td className={styles.tableCell}>{formatIdr(ad.metrics.spend)}</td>
                    <td className={styles.tableCell}>{ad.daysSinceCreation} hari lalu</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  accentClass,
}: {
  readonly label: string;
  readonly value: string;
  readonly accentClass?: string;
}): React.ReactElement {
  return (
    <div>
      <p className={styles.kpiLabel}>{label}</p>
      <p className={`${styles.kpiValue} ${accentClass ?? ""}`}>{value}</p>
    </div>
  );
}

function Header({
  onPull,
  loading,
}: {
  readonly onPull: () => void;
  readonly loading: boolean;
}): React.ReactElement {
  return (
    <div className={styles.headerWrap}>
      {/* Decorative wayfinding only (real page names, no real breadcrumb-trail data source
          exists) — `TopBar.tsx` only ever receives a single title string from its caller, so this
          lives inside the page itself rather than fabricating a breadcrumb capability there. */}
      <p className={styles.breadcrumb}>AAOS › Samantha › Audit Biaya</p>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>💰 Audit Biaya</h2>
          <p className={styles.subtitle}>
            Belanja per funnel & cabang, Rp/chat, deteksi pemborosan ber-ID (#A/#B/#C)
          </p>
        </div>
        <button
          type="button"
          onClick={onPull}
          disabled={loading}
          className={styles.secondaryButton}
        >
          ↻ Tarik Data Baru
        </button>
      </div>
    </div>
  );
}
