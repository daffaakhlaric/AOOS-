"use client";

import { useEffect, useState } from "react";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { formatDateId } from "@/lib/formatters";
import type { IntelligenceSignalsDto } from "@/types/dashboard.types";

import styles from "./IntelligenceSignalsCard.module.css";

type LoadState =
  | { readonly status: "loading" }
  | { readonly status: "empty" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "success"; readonly signals: IntelligenceSignalsDto };

interface SignalRow {
  readonly icon: string;
  readonly label: string;
  readonly text: string;
}

/**
 * One line per real signal source, straight from `IntelligenceService.refresh()`'s own
 * `buildXContext` `reasoning` strings — the exact same Indonesian sentences the real Daily Digest
 * (`buildDigestText`) already renders, so this card never invents a second phrasing. The spec's
 * mockup 7th row ("🤖 Benchmark Rp/lead 29% di bawah industri") is dropped entirely — confirmed via
 * direct read of `IntelligenceSignalsResponseDto`/`CampaignStrategyRequestDto`: there is no real
 * `meta_benchmark`/anomaly field anywhere in the persisted row or the LLM request shape (the
 * coordinator note's point 1 flags this "Meta MCP" benchmark tool as fictional), so rendering it
 * would mean fabricating a number — same discipline as `AbTestingClient`'s dropped "Budget
 * Dihemat" and `LookalikeClient`'s dropped comparison table.
 */
function buildSignalRows(signals: IntelligenceSignalsDto): readonly SignalRow[] {
  return [
    { icon: "📈", label: "Google Trends", text: signals.trends.reasoning },
    { icon: "📅", label: "Seasonal", text: signals.seasonal.reasoning },
    { icon: "🔍", label: "Kompetitor", text: signals.competitor.reasoning },
    {
      icon: "📦",
      label: "Stok/Listing",
      text: signals.inventory.available
        ? signals.inventory.reasoning
        : "Data stok otomotif belum tersedia — belum ada layanan stok real yang terhubung untuk vertical ini.",
    },
    {
      icon: "👥",
      label: "Lead Profile",
      text: `${String(signals.leadProfile.totalLeads)} hot lead, rata-rata skor ${signals.leadProfile.avgScore.toFixed(1)}${
        signals.leadProfile.topBranches[0] !== undefined
          ? ` · terbanyak di ${signals.leadProfile.topBranches[0].branchId}`
          : ""
      }`,
    },
    {
      icon: "💰",
      label: "Closing (90 hari)",
      text: `${String(signals.closing.totalEvents)} event${
        signals.closing.topUnitModels[0] !== undefined
          ? ` · closing rate tertinggi: ${signals.closing.topUnitModels[0].unitModel} (${(signals.closing.topUnitModels[0].closingRate * 100).toFixed(0)}%)`
          : ""
      }`,
    },
  ];
}

/** Real recommendation line from `campaignStrategy` — no fabricated "Tamara suggest" text when the LLM step degraded. */
function strategyLine(signals: IntelligenceSignalsDto): string {
  const strategy = signals.campaignStrategy;
  if (strategy === undefined) {
    return "Belum ada rekomendasi strategi untuk run ini.";
  }
  if (!strategy.available) {
    return `AI tidak tersedia (${strategy.reason}) — ${strategy.message}`;
  }
  const parts: string[] = [];
  if (strategy.brandCampaign !== undefined) {
    parts.push(
      `BRAND ${String(strategy.brandCampaign.budgetPct)}% ${strategy.brandCampaign.angle}`,
    );
  }
  if (strategy.productCampaign !== undefined) {
    parts.push(
      `PRODUCT ${String(strategy.productCampaign.budgetPct)}% ${strategy.productCampaign.angle} — ${strategy.productCampaign.targetUnit}`,
    );
  }
  return parts.length > 0 ? parts.join(" + ") : strategy.summary;
}

/**
 * Minimal runtime shape guard on the parsed `/api/intelligence/signals`|`/refresh` body — this
 * page's own tests, and `StrategiClient`'s pre-existing tests (which mount this card as a side
 * effect and mock `fetch` for their own unrelated URLs, falling through to a generic 200 response
 * for anything else), can hand this component JSON that isn't really an `IntelligenceSignalsDto`.
 * Real defensive parsing (same discipline as `callAaosApi`'s own non-JSON-body guard) rather than
 * trusting the shape and crashing the render.
 */
function isValidSignalsBody(body: unknown): body is { readonly signals: IntelligenceSignalsDto } {
  if (typeof body !== "object" || body === null || !("signals" in body)) {
    return false;
  }
  const signals = (body as { readonly signals: unknown }).signals;
  return (
    typeof signals === "object" &&
    signals !== null &&
    typeof (signals as { readonly generatedAt?: unknown }).generatedAt === "string"
  );
}

/**
 * "Intelligence Signals" card (AAOS-TAMARA-INTELLIGENCE-LAYER Phase 5, spec's `PART 5: UI UPDATE —
 * STRATEGI PAGE`) — real `GET /api/intelligence/signals` + `[Refresh]` calling the real
 * `POST /api/intelligence/refresh`. Additive to `StrategiClient`, not a restructure of it.
 *
 * The spec's mockup also shows `[✓ Setujui Strategi Ini] [Lihat Detail] [Override]` action buttons
 * under the recommendation — omitted here: there is no real endpoint anywhere in `aaos-api` to
 * record approval/override of a `campaignStrategy` row (only the existing, real per-ad
 * verdict-approve flow this page already has below), so wiring those buttons would mean pointing
 * them at nothing real.
 */
export function IntelligenceSignalsCard(): React.ReactElement {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  async function load(): Promise<void> {
    try {
      const res = await fetch("/api/intelligence/signals");
      if (res.status === 404) {
        setState({ status: "empty" });
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        setState({
          status: "error",
          message: body.error?.message ?? "Gagal memuat Intelligence Signals.",
        });
        return;
      }
      const body: unknown = await res.json();
      if (!isValidSignalsBody(body)) {
        setState({ status: "error", message: "Format respons Intelligence Signals tidak valid." });
        return;
      }
      setState({ status: "success", signals: body.signals });
    } catch {
      setState({ status: "error", message: "Gagal memuat Intelligence Signals." });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleRefresh(): Promise<void> {
    setRefreshing(true);
    try {
      const res = await fetch("/api/intelligence/refresh", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        setState({
          status: "error",
          message: body.error?.message ?? "Gagal menjalankan Tamara Intelligence.",
        });
        return;
      }
      const body: unknown = await res.json();
      if (!isValidSignalsBody(body)) {
        setState({ status: "error", message: "Format respons Intelligence Signals tidak valid." });
        return;
      }
      setState({ status: "success", signals: body.signals });
    } catch {
      setState({ status: "error", message: "Gagal menjalankan Tamara Intelligence." });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section data-testid="intelligence-signals-card" className={styles.card}>
      <div className={styles.header}>
        <p className={styles.title}>🧠 Intelligence Signals</p>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={() => void handleRefresh()}
          disabled={refreshing}
        >
          {refreshing ? "↻ Memperbarui…" : "↻ Refresh"}
        </button>
      </div>

      {state.status === "loading" ? <p className={styles.mutedText}>Memuat sinyal…</p> : null}

      {state.status === "empty" ? (
        <p className={styles.mutedText}>
          Belum ada Tamara Intelligence run untuk tenant ini. Tekan Refresh untuk menjalankan
          analisa pertama.
        </p>
      ) : null}

      {state.status === "error" ? <ErrorCard message={state.message} /> : null}

      {state.status === "success" ? (
        <div data-testid="intelligence-signals-result">
          <ul className={styles.signalList}>
            {buildSignalRows(state.signals).map((row) => (
              <li key={row.label} className={styles.signalRow}>
                <span aria-hidden="true" className={styles.signalIcon}>
                  {row.icon}
                </span>
                <span className={styles.signalLabel}>{row.label}</span>
                <span className={styles.signalText}>{row.text}</span>
              </li>
            ))}
          </ul>

          <div className={styles.strategyBlock}>
            <p className={styles.strategyLabel}>Tamara suggest:</p>
            <p className={styles.strategyText}>{strategyLine(state.signals)}</p>
          </div>

          <p className={styles.generatedAt}>
            Terakhir diperbarui: {formatDateId(state.signals.generatedAt)}
          </p>
        </div>
      ) : null}
    </section>
  );
}
