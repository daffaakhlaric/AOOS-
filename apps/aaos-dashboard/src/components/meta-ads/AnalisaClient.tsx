"use client";

import { useState } from "react";

import { VerdictBadge } from "@/components/meta-ads/VerdictBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { stripAdNameSuffix } from "@/lib/adName";
import { formatIdr, formatNumber } from "@/lib/formatters";
import { useCampaignsSnapshot } from "@/lib/useCampaignsSnapshot";
import type {
  AdAccountSummaryDto,
  CampaignAdDto,
  LlmAnalyzeResponseDto,
} from "@/types/dashboard.types";

import styles from "./AnalisaClient.module.css";

const RP_PER_CHAT_THRESHOLD = 25_000;

/**
 * Spec Section 2's exact Rp/Lead → verdict thresholds, applied to per-BRANCH aggregate cost-per-
 * lead — distinct from (and does not override) `ad.verdict`, the real per-AD `VerdictEngine`
 * output Section 3 renders untouched. Returns just the label — rendering now goes through
 * `VerdictBadge`'s shared local color-map (extended with `CUT` in the UI-overhaul pass) instead of
 * a second, duplicate inline tone map.
 */
function branchVerdict(rpLead: number | null): string {
  if (rpLead === null) {
    return "REVIEW";
  }
  if (rpLead < 10_000) {
    return "SCALE";
  }
  if (rpLead < 20_000) {
    return "KEEP";
  }
  if (rpLead < 40_000) {
    return "REVIEW";
  }
  return "CUT";
}

interface BranchStat {
  readonly branch: string;
  readonly spend: number;
  readonly leads: number;
  readonly rpLead: number | null;
}

function statsByBranch(ads: readonly CampaignAdDto[]): readonly BranchStat[] {
  const groups = new Map<string, { spend: number; leads: number }>();
  for (const ad of ads) {
    const current = groups.get(ad.branch) ?? { spend: 0, leads: 0 };
    groups.set(ad.branch, {
      spend: current.spend + ad.metrics.spend,
      leads: current.leads + ad.metrics.totalLead,
    });
  }
  return [...groups.entries()]
    .map(([branch, totals]) => ({
      branch,
      spend: totals.spend,
      leads: totals.leads,
      rpLead: totals.leads > 0 ? totals.spend / totals.leads : null,
    }))
    .sort((a, b) => b.spend - a.spend);
}

function rpPerChat(spend: number, conversations: number): number | null {
  return conversations > 0 ? spend / conversations : null;
}

function reasonFor(ad: CampaignAdDto): string {
  const rpChat = rpPerChat(ad.metrics.spend, ad.metrics.conversations);
  if (rpChat === null) {
    return "Belum ada percakapan tercatat.";
  }
  if (rpChat > RP_PER_CHAT_THRESHOLD) {
    return `Rp/chat ${formatIdr(rpChat)} — di atas ambang batas ${formatIdr(RP_PER_CHAT_THRESHOLD)}.`;
  }
  return `Rp/chat ${formatIdr(rpChat)} — dalam ambang batas wajar.`;
}

interface Temuan {
  readonly key: string;
  readonly text: string;
}

/**
 * Left accent-bar color + icon per `Temuan.key` (spec "Analisa & Rekomendasi ... Temuan Utama
 * section: styled insight cards, left colored bar (red/green/orange based on sentiment)"). Maps
 * each of `buildTemuan`'s 3 real finding kinds to a sentiment — "boros"/"waste" (money being
 * wasted) is red, "juara"/"cabang" (a positive standout) is green, everything else is neutral
 * orange/blue. No numeric "metric callout" is fabricated beyond what `buildTemuan` already
 * computed into the finding's own text — this app has no separate structured title/detail/metric
 * fields to pull one from without inventing data.
 */
// `?? ""` resolves the `noUncheckedIndexedAccess` type-only gap on CSS Module property access —
// see VerdictBadge.tsx's docstring for the full explanation.
function temuanStyle(key: string): { readonly bar: string; readonly icon: string } {
  switch (key) {
    case "boros":
    case "waste":
      return { bar: styles.barRed ?? "", icon: "🔴" };
    case "juara":
      return { bar: styles.barGreen ?? "", icon: "🟢" };
    default:
      return { bar: styles.barBlue ?? "", icon: "🔵" };
  }
}

/** Builds Section 1's rule-based bullet points from real branch/campaign aggregates only — no fabricated per-platform (Facebook/Instagram) breakdown, since no real field on `AdMetricsDto`/`CampaignAdDto` distinguishes ad platform. */
function buildTemuan(
  data: AdAccountSummaryDto,
  branches: readonly BranchStat[],
): readonly Temuan[] {
  const temuan: Temuan[] = [];
  const withLead = branches.filter((branch) => branch.rpLead !== null);
  if (withLead.length > 0) {
    const cheapest = withLead.reduce((min, branch) =>
      branch.rpLead! < min.rpLead! ? branch : min,
    );
    const priciest = withLead.reduce((max, branch) =>
      branch.rpLead! > max.rpLead! ? branch : max,
    );
    temuan.push({
      key: "cabang",
      text: `Cabang termurah: ${cheapest.branch} ${formatIdr(cheapest.rpLead ?? 0)}/lead — ${priciest.branch} ${formatIdr(priciest.rpLead ?? 0)}/lead termahal.`,
    });
  }

  const campaignStats = data.campaigns.map((campaign) => {
    const ads = campaign.adSets.flatMap((adSet) => adSet.ads);
    const totalLead = ads.reduce((sum, ad) => sum + ad.metrics.totalLead, 0);
    const rpLead = totalLead > 0 ? campaign.spend / totalLead : null;
    return { name: campaign.name, rpLead };
  });
  const rankable = campaignStats.filter(
    (entry): entry is { name: string; rpLead: number } => entry.rpLead !== null,
  );
  if (rankable.length > 0) {
    const worst = rankable.reduce((max, entry) => (entry.rpLead > max.rpLead ? entry : max));
    const best = rankable.reduce((min, entry) => (entry.rpLead < min.rpLead ? entry : min));
    temuan.push({ key: "boros", text: `Paling boros: ${worst.name} → CUT.` });
    temuan.push({ key: "juara", text: `Paling juara: ${best.name} → SCALE.` });
  }

  const waste = data.ads.reduce((sum, ad) => {
    const rpChat = rpPerChat(ad.metrics.spend, ad.metrics.conversations);
    if (rpChat === null || rpChat <= RP_PER_CHAT_THRESHOLD) {
      return sum;
    }
    return sum + (ad.metrics.spend - RP_PER_CHAT_THRESHOLD * ad.metrics.conversations);
  }, 0);
  if (waste > 0) {
    temuan.push({
      key: "waste",
      text: `Total waste detected: ${formatIdr(waste)} bisa dihemat dari iklan dengan Rp/chat di atas ${formatIdr(RP_PER_CHAT_THRESHOLD)}.`,
    });
  }

  return temuan;
}

type AiState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "success"; readonly result: LlmAnalyzeResponseDto }
  | { readonly status: "no-key" }
  | { readonly status: "error" };

/**
 * "Analisa & Rekomendasi" page (spec `meta-ads/analisa/page.tsx`) — rule-based verdict tables
 * (always shown, Sections 1-3) plus an optional "🤖 Analisa dengan AI" panel that calls
 * `/api/llm/analyze` (spec LLM ADDENDUM Section 4). Per spec Section 7, a missing API key or a
 * failed AI call never hides the rule-based analysis — it only affects the AI panel's own state.
 */
export function AnalisaClient(): React.ReactElement {
  const { data, loading, error, pull } = useCampaignsSnapshot();
  const [ai, setAi] = useState<AiState>({ status: "idle" });

  async function runAiAnalysis(): Promise<void> {
    if (data === undefined) {
      return;
    }
    setAi({ status: "loading" });
    try {
      const res = await fetch("/api/llm/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaigns: data.campaigns, totals: data.totals }),
      });
      if (res.status === 503) {
        setAi({ status: "no-key" });
        return;
      }
      if (!res.ok) {
        setAi({ status: "error" });
        return;
      }
      const result = (await res.json()) as LlmAnalyzeResponseDto;
      setAi({ status: "success", result });
    } catch {
      setAi({ status: "error" });
    }
  }

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

  const branches = statsByBranch(data.ads);
  const temuan = buildTemuan(data, branches);
  const allAds = data.ads;

  const maxBranchSpend = Math.max(1, ...branches.map((branch) => branch.spend));

  return (
    <div className={styles.page}>
      <Header onPull={() => void pull()} loading={loading} />
      {error !== undefined ? <ErrorCard message={error} /> : null}

      <section data-testid="analisa-temuan" className={styles.section}>
        <h3 className={styles.sectionLabel}>Temuan Utama</h3>
        {temuan.length === 0 ? (
          <p className={styles.mutedText}>Belum cukup data untuk temuan.</p>
        ) : (
          <ul className={styles.temuanList}>
            {temuan.map((item) => {
              const style = temuanStyle(item.key);
              return (
                <li key={item.key} className={`${styles.temuanCard} ${style.bar}`}>
                  <span aria-hidden="true">{style.icon}</span>
                  <p className={styles.temuanText}>{item.text}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section data-testid="analisa-branch-verdict" className={styles.section}>
        <h3 className={styles.sectionLabel}>Per Cabang</h3>
        <div className={styles.branchPanel}>
          {branches.map((branch) => {
            const verdict = branchVerdict(branch.rpLead);
            const widthPercent = Math.max(4, (branch.spend / maxBranchSpend) * 100);
            return (
              <div key={branch.branch} className={styles.branchRow}>
                <span className={styles.branchName}>{branch.branch}</span>
                <div className={styles.branchBarTrack}>
                  <div className={styles.branchBarFill} style={{ width: `${widthPercent}%` }} />
                </div>
                <span className={styles.branchValue}>
                  {branch.rpLead !== null ? `${formatIdr(branch.rpLead)}/lead` : "—"}
                </span>
                <VerdictBadge verdict={verdict} />
              </div>
            );
          })}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.tableHeadRow}>
                <th>Nama</th>
                <th>Spend</th>
                <th>Lead</th>
                <th>Rp/Lead</th>
                <th>Vonis</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => {
                const verdict = branchVerdict(branch.rpLead);
                return (
                  <tr key={branch.branch} className={styles.tableRow}>
                    <td className={styles.tableCell}>{branch.branch}</td>
                    <td className={styles.tableCellNum}>{formatIdr(branch.spend)}</td>
                    <td className={styles.tableCellNum}>{formatNumber(branch.leads)}</td>
                    <td className={styles.tableCellNum}>
                      {branch.rpLead !== null ? formatIdr(branch.rpLead) : "—"}
                    </td>
                    <td className={styles.tableCell}>
                      <VerdictBadge verdict={verdict} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section data-testid="analisa-ad-verdict" className={styles.section}>
        <h3 className={styles.sectionLabel}>Per Iklan</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.tableHeadRow}>
                <th>#</th>
                <th>Iklan</th>
                <th>Spend</th>
                <th>Chat</th>
                <th>Rp/Chat</th>
                <th>Verdict</th>
                <th>Alasan</th>
              </tr>
            </thead>
            <tbody>
              {allAds.map((ad) => {
                const rpChat = rpPerChat(ad.metrics.spend, ad.metrics.conversations);
                return (
                  <tr key={ad.id} className={styles.tableRow}>
                    <td className={styles.tableCellMono}>{ad.stableId}</td>
                    <td className={styles.tableCell}>{stripAdNameSuffix(ad.name)}</td>
                    <td className={styles.tableCellNum}>{formatIdr(ad.metrics.spend)}</td>
                    <td className={styles.tableCellNum}>
                      {formatNumber(ad.metrics.conversations)}
                    </td>
                    <td className={styles.tableCellNum}>
                      {rpChat !== null ? formatIdr(rpChat) : "—"}
                    </td>
                    <td className={styles.tableCell}>
                      <VerdictBadge verdict={ad.verdict} />
                    </td>
                    <td className={styles.tableCellMuted}>{reasonFor(ad)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section data-testid="analisa-ai-panel" className={styles.aiPanel}>
        <button
          type="button"
          onClick={() => void runAiAnalysis()}
          disabled={ai.status === "loading"}
          className={styles.aiButton}
        >
          🤖 Analisa dengan AI
        </button>
        {ai.status === "loading" ? (
          <p data-testid="ai-loading" className={styles.mutedText}>
            Tamara sedang menganalisa data iklan…
          </p>
        ) : null}
        {ai.status === "no-key" ? (
          <ErrorCard message="Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings" />
        ) : null}
        {ai.status === "error" ? (
          <ErrorCard message="AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis" />
        ) : null}
        {ai.status === "success" ? (
          <div data-testid="ai-result" className={styles.aiResult}>
            <div>
              <p className={styles.aiResultLabel}>Temuan Utama</p>
              <ul className={styles.aiResultList}>
                {ai.result.temuan.map((item, index) => (
                  <li key={`${item.judul}-${index}`} className={styles.aiResultItem}>
                    {item.icon} {item.judul} — {item.detail}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className={styles.aiResultLabel}>Rekomendasi</p>
              <ul className={styles.aiResultList}>
                {ai.result.rekomendasi.map((item, index) => (
                  <li key={`${item.target}-${index}`} className={styles.aiResultItem}>
                    {item.aksi} — {item.target}: {item.alasan} ({item.estimasi})
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className={styles.aiResultLabel}>Ringkasan Tamara</p>
              <p className={styles.aiResultItem}>{ai.result.ringkasan}</p>
            </div>
          </div>
        ) : null}
      </section>
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
        <h2 className={styles.title}>Analisa & Rekomendasi</h2>
        <p className={styles.subtitle}>
          Verdict per iklan (SCALE/KEEP/REVIEW/PAUSE/FIX) + alasan, ber-ID. Diukur dari Rp/chat.
        </p>
      </div>
      <button type="button" onClick={onPull} disabled={loading} className={styles.secondaryButton}>
        🔄 Tarik data baru
      </button>
    </div>
  );
}
