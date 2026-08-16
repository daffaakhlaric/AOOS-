"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDateTimeIdWib, formatIdr, formatIdrCompact, formatNumber } from "@/lib/formatters";
import { useCampaignsSnapshot } from "@/lib/useCampaignsSnapshot";
import type { AdAccountSummaryDto, CampaignAdDto } from "@/types/dashboard.types";

import styles from "./AuditClient.module.css";

/** DSS Motor's real funnel labels — `Funnel` enum (`@aos/meta-ads-connector`), Indonesian display labels for this page's grouping (spec Section 2, adapted to coordinator note #1: group by the real `ad.funnel` field, never a second classifier). */
const FUNNEL_LABELS: Readonly<Record<string, string>> = {
  BRAND_BOOST: "Brand/Boost",
  DM: "DM Multi-channel",
  CTWA: "CTWA",
  WEBSITE_LEAD: "Website Lead (LP)",
};

const RP_PER_CHAT_THRESHOLD = 25_000;
const FREQUENCY_THRESHOLD = 3.5;
const NEW_AD_MAX_DAYS = 14;
const OUTCOME_LEADS = "OUTCOME_LEADS";

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

interface FunnelGroup {
  readonly funnel: string;
  readonly spend: number;
  readonly conversations: number;
}

function groupByFunnel(ads: readonly CampaignAdDto[]): readonly FunnelGroup[] {
  const groups = new Map<string, { spend: number; conversations: number }>();
  for (const ad of ads) {
    const current = groups.get(ad.funnel) ?? { spend: 0, conversations: 0 };
    groups.set(ad.funnel, {
      spend: current.spend + ad.metrics.spend,
      conversations: current.conversations + ad.metrics.conversations,
    });
  }
  return [...groups.entries()]
    .map(([funnel, totals]) => ({ funnel, ...totals }))
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

/**
 * "Audit Biaya" page (spec `meta-ads/audit/page.tsx`) — belanja per funnel/cabang, waste
 * detection, and new-ad tracking, all read from the SAME cached snapshot `/meta-ads`'s "Data
 * Iklan" page pulls (coordinator note #7). Never fetches on mount; a "🔄 Tarik data baru" button
 * force-pulls fresh data, matching `MetaAdsClient.tsx`'s house style (coordinator note #7).
 *
 * Coordinator note #1: funnel/branch grouping reuses the real `ad.funnel`/`ad.branch` fields
 * `aaos-api` already computed (`FunnelClassifier`/`BranchExtractor`) — this page never runs its
 * own classifier, so it can never disagree with "Data Iklan" about which funnel/branch an ad
 * belongs to.
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
  const funnelGroups = groupByFunnel(data.ads);
  const branchGroups = groupByBranch(data.ads);
  const adSetCount = data.campaigns.reduce((sum, campaign) => sum + campaign.adSets.length, 0);
  const totalRpPerChat = rpPerChat(data.totals.spend, data.totals.conversations);

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
        <Kpi label="Rp/Chat" value={totalRpPerChat !== null ? formatIdr(totalRpPerChat) : "—"} />
        <Kpi label="Kampanye" value={formatNumber(data.campaignCount)} />
        <Kpi label="Ad Set" value={formatNumber(adSetCount)} />
        <Kpi label="Iklan" value={formatNumber(data.adCount)} />
      </section>

      <section data-testid="audit-funnel-section" className={styles.section}>
        <h3 className={styles.sectionTitle}>Belanja per Funnel</h3>
        {funnelGroups.length === 0 ? (
          <p className={styles.mutedText}>Tidak ada data funnel.</p>
        ) : (
          <ul className={styles.groupList}>
            {funnelGroups.map((group) => {
              const perChat = rpPerChat(group.spend, group.conversations);
              return (
                <li key={group.funnel} className={styles.groupCard}>
                  <p className={styles.groupName}>{FUNNEL_LABELS[group.funnel] ?? group.funnel}</p>
                  <p className={styles.groupMeta}>
                    {formatIdr(group.spend)} · {formatNumber(group.conversations)} chat
                    {perChat !== null ? ` · ${formatIdr(perChat)}/chat` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section data-testid="audit-branch-section" className={styles.section}>
        <h3 className={styles.sectionTitle}>Belanja per Cabang</h3>
        {branchGroups.length === 0 ? (
          <p className={styles.mutedText}>Tidak ada data cabang.</p>
        ) : (
          <ul className={styles.groupList}>
            {branchGroups.map((group) => (
              <li key={group.branch} className={styles.groupCard}>
                <p className={styles.groupName}>{group.branch}</p>
                <p className={styles.groupMeta}>
                  {formatIdr(group.spend)} · {formatNumber(group.adCount)} iklan
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section data-testid="audit-waste-section" className={styles.section}>
        <h3 className={styles.sectionTitle}>Deteksi Pemborosan</h3>

        <div className={styles.wasteBlock}>
          <p className={styles.wasteLabel}>🎯 Salah tujuan (objective ≠ OUTCOME_LEADS)</p>
          {salahTujuan.length === 0 ? (
            <p className={styles.mutedText}>Tidak ada.</p>
          ) : (
            <ul className={styles.wasteList}>
              {salahTujuan.map((entry) => {
                const perChat = rpPerChat(entry.ad.metrics.spend, entry.ad.metrics.conversations);
                return (
                  <li key={entry.ad.id} className={styles.wasteItem}>
                    {entry.ad.stableId} {entry.ad.name} —{" "}
                    {perChat !== null ? formatIdr(perChat) : "—"}/chat
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={styles.wasteBlock}>
          <p className={styles.wasteLabel}>🔁 Audiens jenuh (frequency ≥ {FREQUENCY_THRESHOLD})</p>
          {audiensJenuh.length === 0 ? (
            <p className={styles.mutedText}>Tidak ada.</p>
          ) : (
            <ul className={styles.wasteList}>
              {audiensJenuh.map((ad) => (
                <li key={ad.id} className={styles.wasteItem}>
                  {ad.stableId} {ad.name} — frequency {ad.metrics.frequency.toFixed(1)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.wasteBlock}>
          <p className={styles.wasteLabel}>
            💸 Rp/chat terlalu mahal (&gt; {formatIdr(RP_PER_CHAT_THRESHOLD)}/chat)
          </p>
          {rpChatMahal.length === 0 ? (
            <p className={styles.mutedText}>Tidak ada.</p>
          ) : (
            <ul className={styles.wasteList}>
              {rpChatMahal.map(({ ad, rpChat }) => (
                <li key={ad.id} className={styles.wasteItem}>
                  {ad.stableId} {ad.name} — {formatIdr(rpChat)}/chat
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section data-testid="audit-new-ads-section" className={styles.section}>
        <h3 className={styles.sectionTitle}>Iklan Baru (14 hari terakhir)</h3>
        {iklanBaru.length === 0 ? (
          <p className={styles.mutedText}>Tidak ada iklan baru.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHeadRow}>
                  <th>#</th>
                  <th>Iklan</th>
                  <th>Funnel</th>
                  <th>Cabang</th>
                  <th>Status</th>
                  <th>Belanja</th>
                  <th>Dibuat</th>
                </tr>
              </thead>
              <tbody>
                {iklanBaru.map((ad) => (
                  <tr key={ad.id} className={styles.tableRow}>
                    <td className={styles.tableCell}>{ad.stableId}</td>
                    <td className={styles.tableCell}>{ad.name}</td>
                    <td className={styles.tableCell}>{FUNNEL_LABELS[ad.funnel] ?? ad.funnel}</td>
                    <td className={styles.tableCell}>{ad.branch}</td>
                    <td className={styles.tableCell}>{ad.status}</td>
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
}: {
  readonly label: string;
  readonly value: string;
}): React.ReactElement {
  return (
    <div>
      <p className={styles.kpiLabel}>{label}</p>
      <p className={styles.kpiValue}>{value}</p>
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
    <div className={styles.headerRow}>
      <div>
        <h2 className={styles.title}>💰 Audit Biaya</h2>
        <p className={styles.subtitle}>
          Belanja per funnel & cabang, Rp per percakapan, iklan baru, dan deteksi pemborosan ber-ID
          (#A/#B/#C).
        </p>
      </div>
      <button type="button" onClick={onPull} disabled={loading} className={styles.secondaryButton}>
        🔄 Tarik data baru
      </button>
    </div>
  );
}
