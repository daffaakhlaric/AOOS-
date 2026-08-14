"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { stripAdNameSuffix } from "@/lib/adName";
import { formatIdr, formatNumber } from "@/lib/formatters";
import { useCampaignsSnapshot } from "@/lib/useCampaignsSnapshot";
import type { CampaignAdDto } from "@/types/dashboard.types";

type Decision = "approved" | "rejected";

/** `localStorage` key for this snapshot's approve/reject decisions — namespaced by `fetchedAt` (spec "Track approved/rejected in localStorage per snapshot"): a fresh pull is a new snapshot with a clean decision slate, so decisions never leak across pulls. */
function decisionsKey(fetchedAt: number): string {
  return `aaos_strategi_decisions_${fetchedAt}`;
}

function readDecisions(fetchedAt: number): Record<string, Decision> {
  try {
    const raw = localStorage.getItem(decisionsKey(fetchedAt));
    if (raw === null) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, Decision>)
      : {};
  } catch {
    return {};
  }
}

function writeDecisions(fetchedAt: number, decisions: Record<string, Decision>): void {
  localStorage.setItem(decisionsKey(fetchedAt), JSON.stringify(decisions));
}

interface ActionInfo {
  readonly icon: string;
  readonly label: string;
}

/** Maps a real `ad.verdict` (`VerdictEngine`'s output) to the spec's proposed-action button label — presentational only, never recomputes the verdict itself. */
function actionFor(verdict: string): ActionInfo {
  switch (verdict) {
    case "PAUSE":
      return { icon: "🔴", label: "Matikan" };
    case "FIX":
      return { icon: "🔄", label: "Betulkan tujuan" };
    case "SCALE":
      return { icon: "📈", label: "Naikkan budget" };
    default:
      return { icon: "🔍", label: "Tinjau" };
  }
}

/** Left accent-bar color per verdict (spec "Strategi & Approve ... Card with left border color (red=pause, yellow=fix, green=scale)"). Local color map, same pattern as `VerdictBadge.tsx`/`CampaignTree.tsx`'s accent bars — not a shared token. */
function accentBorderColor(verdict: string): string {
  switch (verdict) {
    case "PAUSE":
      return "border-l-[#DC2626]";
    case "FIX":
      return "border-l-[#D97706]";
    case "SCALE":
      return "border-l-[#1A9E5C]";
    default:
      return "border-l-[#2563EB]";
  }
}

/** Estimated monthly savings, in Rupiah, for a non-SCALE (PAUSE/FIX/REVIEW) ad — used by the bottom sticky bar's "Total hemat est." rollup. `null` for SCALE ads, which grow spend rather than save it. */
function estimatedSavings(ad: CampaignAdDto): number | null {
  return ad.verdict === "SCALE" ? null : ad.metrics.spend;
}

function rpPerChat(spend: number, conversations: number): number | null {
  return conversations > 0 ? spend / conversations : null;
}

function estimateFor(ad: CampaignAdDto): string {
  if (ad.verdict === "SCALE") {
    return `estimasi tambah ${formatNumber(ad.metrics.totalLead)} lead/bulan`;
  }
  return `estimasi hemat ${formatIdr(ad.metrics.spend)}/bulan`;
}

function reasonFor(ad: CampaignAdDto): string {
  const rpChat = rpPerChat(ad.metrics.spend, ad.metrics.conversations);
  return rpChat !== null ? `Rp/chat ${formatIdr(rpChat)}` : "Belum ada percakapan tercatat.";
}

interface ExecuteResult {
  readonly targetId: string;
  readonly ok: boolean;
}

/**
 * "Strategi & Approve" page (spec `meta-ads/strategi/page.tsx`) — lists every ad whose real
 * `verdict` isn't `KEEP`, lets a manager approve/reject Tamara's proposed action per ad, then
 * executes all approved items.
 *
 * Coordinator note #6: `POST /api/v1/verdicts` (this app's own `/api/verdicts` proxy) takes ONE
 * `{ verdict, targetId, targetType }` per call — no bulk variant — so "Execute Semua yang
 * Disetujui" loops, calling it once per approved ad and tracking success/failure per item rather
 * than treating the whole batch as all-or-nothing.
 */
export function StrategiClient(): React.ReactElement {
  const { data, fetchedAt, loading, error, pull } = useCampaignsSnapshot();
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<readonly ExecuteResult[] | undefined>(undefined);

  useEffect(() => {
    if (fetchedAt !== undefined) {
      setDecisions(readDecisions(fetchedAt));
    }
  }, [fetchedAt]);

  function decide(adId: string, decision: Decision): void {
    if (fetchedAt === undefined) {
      return;
    }
    const next = { ...decisions, [adId]: decision };
    setDecisions(next);
    writeDecisions(fetchedAt, next);
  }

  async function executeApproved(actionable: readonly CampaignAdDto[]): Promise<void> {
    const approved = actionable.filter((ad) => decisions[ad.id] === "approved");
    if (approved.length === 0) {
      return;
    }
    setExecuting(true);
    setResults(undefined);
    const outcomes: ExecuteResult[] = [];
    for (const ad of approved) {
      try {
        const res = await fetch("/api/verdicts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ verdict: ad.verdict, targetId: ad.id, targetType: "ad" }),
        });
        outcomes.push({ targetId: ad.id, ok: res.ok });
      } catch {
        outcomes.push({ targetId: ad.id, ok: false });
      }
    }
    setResults(outcomes);
    setExecuting(false);
    await pull();
  }

  if (data === undefined) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Header />
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

  const actionable = data.ads.filter((ad) => ad.verdict !== "KEEP");
  const approvedCount = actionable.filter((ad) => decisions[ad.id] === "approved").length;
  const failedCount = results?.filter((result) => !result.ok).length ?? 0;
  const estimatedSavingsTotal = actionable
    .filter((ad) => decisions[ad.id] === "approved")
    .reduce((sum, ad) => sum + (estimatedSavings(ad) ?? 0), 0);

  return (
    // Bottom padding reserves room for the sticky approve-summary bar below so it never overlaps
    // the last card (spec "Bottom sticky bar").
    <div className="flex animate-fade-in flex-col gap-4 p-8 pb-24 sm:p-10 sm:pb-24">
      <Header />
      {error !== undefined ? <ErrorCard message={error} /> : null}

      {actionable.length === 0 ? (
        <EmptyState
          title="Semua iklan sudah KEEP"
          description="Tidak ada rekomendasi yang perlu dieksekusi saat ini."
        />
      ) : (
        <ul data-testid="strategi-list" className="flex flex-col gap-3">
          {actionable.map((ad) => {
            const action = actionFor(ad.verdict);
            const decision = decisions[ad.id];
            const approved = decision === "approved";
            return (
              <li
                key={ad.id}
                className={`card-hover-lift relative rounded-card border border-l-4 border-hairline-card p-4 shadow-card ${accentBorderColor(ad.verdict)} ${
                  approved ? "bg-hairline-subtle" : "bg-surface-card"
                }`}
              >
                {approved ? (
                  <span className="absolute right-4 top-4 text-xs font-semibold text-[#1A9E5C]">
                    Disetujui ✓
                  </span>
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {action.icon} {action.label}
                    </p>
                    <p className="text-sm text-ink">
                      {ad.stableId} {stripAdNameSuffix(ad.name)}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {reasonFor(ad)} · {estimateFor(ad)}
                    </p>
                  </div>
                  {!approved ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => decide(ad.id, "rejected")}
                        className="btn-press rounded-button border border-hairline-card px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-page"
                      >
                        Tolak
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(ad.id, "approved")}
                        className="btn-press rounded-button bg-brand-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0070E0]"
                      >
                        ✓ Setujui
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => decide(ad.id, "rejected")}
                      data-testid={`approved-badge-${ad.id}`}
                      className="btn-press mt-6 shrink-0 rounded-button border border-hairline-card px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-page"
                    >
                      Tolak
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {actionable.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-10 flex items-center gap-3 border-t border-hairline-card bg-surface-card px-8 py-3 shadow-card md:left-[220px] md:px-10">
          <p className="text-sm text-ink-muted">
            {approvedCount} item disetujui · Total hemat est. {formatIdr(estimatedSavingsTotal)}
          </p>
          <button
            type="button"
            onClick={() => void executeApproved(actionable)}
            disabled={executing || approvedCount === 0}
            className="btn-press ml-auto rounded-button bg-brand-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            ⚡ Execute Semua ({approvedCount})
          </button>
          {executing ? <p className="text-sm text-ink-muted">Mengeksekusi…</p> : null}
          {!executing && results !== undefined ? (
            <p data-testid="execute-summary" className="text-sm text-ink-muted">
              {results.length - failedCount}/{results.length} berhasil dieksekusi
              {failedCount > 0 ? ` · ${failedCount} gagal` : ""}.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Header(): React.ReactElement {
  return (
    <div>
      <h2 className="text-[26px] font-semibold -tracking-[0.5px] text-ink">Strategi & Approve</h2>
      <p className="mt-0.5 text-[13px] text-ink-muted">
        Eksekusi verdict — setujui atau tolak rekomendasi Tamara.
      </p>
    </div>
  );
}
