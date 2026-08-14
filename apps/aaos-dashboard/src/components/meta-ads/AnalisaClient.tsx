"use client";

import { useState } from "react";

import { VerdictBadge } from "@/components/meta-ads/VerdictBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatIdr, formatNumber } from "@/lib/formatters";
import { useCampaignsSnapshot } from "@/lib/useCampaignsSnapshot";
import type {
  AdAccountSummaryDto,
  CampaignAdDto,
  LlmAnalyzeResponseDto,
} from "@/types/dashboard.types";

const RP_PER_CHAT_THRESHOLD = 25_000;

/** Spec Section 2's exact Rp/Lead → verdict thresholds, applied to per-BRANCH aggregate cost-per-lead — distinct from (and does not override) `ad.verdict`, the real per-AD `VerdictEngine` output Section 3 renders untouched. */
function branchVerdict(rpLead: number | null): { label: string; tone: string } {
  if (rpLead === null) {
    return { label: "REVIEW", tone: "border-orange-300 bg-orange-50 text-orange-700" };
  }
  if (rpLead < 10_000) {
    return { label: "SCALE", tone: "border-green-300 bg-green-50 text-green-700" };
  }
  if (rpLead < 20_000) {
    return { label: "KEEP", tone: "border-blue-300 bg-blue-50 text-blue-700" };
  }
  if (rpLead < 40_000) {
    return { label: "REVIEW", tone: "border-orange-300 bg-orange-50 text-orange-700" };
  }
  return { label: "CUT", tone: "border-red-300 bg-red-50 text-red-700" };
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
      <div className="flex flex-col gap-4 p-6">
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

  return (
    <div className="flex flex-col gap-6 p-6">
      <Header onPull={() => void pull()} loading={loading} />
      {error !== undefined ? <ErrorCard message={error} /> : null}

      <section data-testid="analisa-temuan" className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">Temuan Utama</h3>
        {temuan.length === 0 ? (
          <p className="text-sm text-ink-muted">Belum cukup data untuk temuan.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {temuan.map((item) => (
              <li key={item.key} className="text-sm text-ink">
                • {item.text}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section data-testid="analisa-branch-verdict" className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">Per Cabang</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-ink-muted">
                <th className="py-1 pr-3">Nama</th>
                <th className="py-1 pr-3">Spend</th>
                <th className="py-1 pr-3">Lead</th>
                <th className="py-1 pr-3">Rp/Lead</th>
                <th className="py-1 pr-3">Vonis</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => {
                const verdict = branchVerdict(branch.rpLead);
                return (
                  <tr key={branch.branch} className="border-t border-hairline">
                    <td className="py-1 pr-3">{branch.branch}</td>
                    <td className="py-1 pr-3">{formatIdr(branch.spend)}</td>
                    <td className="py-1 pr-3">{formatNumber(branch.leads)}</td>
                    <td className="py-1 pr-3">
                      {branch.rpLead !== null ? formatIdr(branch.rpLead) : "—"}
                    </td>
                    <td className="py-1 pr-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${verdict.tone}`}
                      >
                        {verdict.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section data-testid="analisa-ad-verdict" className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">Per Iklan</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-ink-muted">
                <th className="py-1 pr-3">#</th>
                <th className="py-1 pr-3">Iklan</th>
                <th className="py-1 pr-3">Spend</th>
                <th className="py-1 pr-3">Chat</th>
                <th className="py-1 pr-3">Rp/Chat</th>
                <th className="py-1 pr-3">Verdict</th>
                <th className="py-1 pr-3">Alasan</th>
              </tr>
            </thead>
            <tbody>
              {allAds.map((ad) => {
                const rpChat = rpPerChat(ad.metrics.spend, ad.metrics.conversations);
                return (
                  <tr key={ad.id} className="border-t border-hairline">
                    <td className="py-1 pr-3">{ad.stableId}</td>
                    <td className="py-1 pr-3">{ad.name}</td>
                    <td className="py-1 pr-3">{formatIdr(ad.metrics.spend)}</td>
                    <td className="py-1 pr-3">{formatNumber(ad.metrics.conversations)}</td>
                    <td className="py-1 pr-3">{rpChat !== null ? formatIdr(rpChat) : "—"}</td>
                    <td className="py-1 pr-3">
                      <VerdictBadge verdict={ad.verdict} />
                    </td>
                    <td className="py-1 pr-3">{reasonFor(ad)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section data-testid="analisa-ai-panel" className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => void runAiAnalysis()}
          disabled={ai.status === "loading"}
          className="w-fit rounded-button border border-hairline px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
        >
          🤖 Analisa dengan AI
        </button>
        {ai.status === "loading" ? (
          <p data-testid="ai-loading" className="text-sm text-ink-muted">
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
          <div
            data-testid="ai-result"
            className="flex flex-col gap-3 rounded-card border border-hairline bg-surface-card p-4"
          >
            <div>
              <p className="text-xs font-semibold text-ink-muted">Temuan Utama</p>
              <ul className="mt-1 flex flex-col gap-1">
                {ai.result.temuan.map((item, index) => (
                  <li key={`${item.judul}-${index}`} className="text-sm text-ink">
                    {item.icon} {item.judul} — {item.detail}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-muted">Rekomendasi</p>
              <ul className="mt-1 flex flex-col gap-1">
                {ai.result.rekomendasi.map((item, index) => (
                  <li key={`${item.target}-${index}`} className="text-sm text-ink">
                    {item.aksi} — {item.target}: {item.alasan} ({item.estimasi})
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-muted">Ringkasan Tamara</p>
              <p className="text-sm text-ink">{ai.result.ringkasan}</p>
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
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-base font-semibold text-ink">🎯 Analisa & Rekomendasi</h2>
        <p className="text-xs text-ink-muted">
          Verdict per iklan (SCALE/KEEP/REVIEW/PAUSE/FIX) + alasan, ber-ID. Diukur dari Rp/chat.
        </p>
      </div>
      <button
        type="button"
        onClick={onPull}
        disabled={loading}
        className="rounded-button border border-hairline px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
      >
        🔄 Tarik data baru
      </button>
    </div>
  );
}
