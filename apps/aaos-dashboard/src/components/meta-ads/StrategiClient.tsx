"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
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

  return (
    <div className="flex flex-col gap-4 p-6">
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
            return (
              <li
                key={ad.id}
                className="rounded-card border border-hairline bg-surface-card p-4 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {action.icon} {action.label}
                    </p>
                    <p className="text-sm text-ink">
                      {ad.stableId} {ad.name}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {reasonFor(ad)} · {estimateFor(ad)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {decision === "approved" ? (
                      <span
                        data-testid={`approved-badge-${ad.id}`}
                        className="rounded-full border border-green-300 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700"
                      >
                        Disetujui ✅
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => decide(ad.id, "rejected")}
                      className="rounded-button border border-hairline px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-page"
                    >
                      Tolak
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(ad.id, "approved")}
                      className="rounded-button border border-brand-primary bg-brand-primary/10 px-3 py-1.5 text-sm font-semibold text-brand-primary"
                    >
                      ✅ Setujui
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {actionable.length > 0 ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void executeApproved(actionable)}
            disabled={executing || approvedCount === 0}
            className="rounded-button bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            ⚡ Execute Semua yang Disetujui ({approvedCount})
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
      <h2 className="text-base font-semibold text-ink">🧭 Strategi & Approve</h2>
      <p className="text-xs text-ink-muted">
        Eksekusi verdict — setujui atau tolak rekomendasi Tamara.
      </p>
    </div>
  );
}
