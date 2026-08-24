"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { stripAdNameSuffix } from "@/lib/adName";
import { formatDateId, formatIdr, formatIdrCompact, formatNumber } from "@/lib/formatters";
import { useCampaignsSnapshot } from "@/lib/useCampaignsSnapshot";
import type {
  AdAccountSummaryDto,
  CampaignAdDto,
  LlmAnalyzeResponseDto,
  LlmChatMessageDto,
} from "@/types/dashboard.types";

import { IntelligenceSignalsCard } from "./IntelligenceSignalsCard";
import styles from "./StrategiClient.module.css";

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

/**
 * Real `Verdict` enum values this page ever needs a proposed-action label for (`VerdictEngine.ts`,
 * `@aos/meta-ads-connector`). "GESER" (shift budget) does not exist as a real verdict — the UI
 * rebuild spec this component follows proposed it, but there is no engine output, no threshold,
 * and no execution path (`POST /api/v1/verdicts`'s `ExecuteVerdictBodyDto` accepts only real
 * `Verdict` members) that could ever produce or act on it, so it was NOT implemented. `KEEP` is
 * excluded on purpose too — a KEEP ad has no proposed action, which is exactly why `actionable`
 * below filters it out (unchanged from the pre-rebuild version).
 */
type ActionableVerdict = "PAUSE" | "FIX" | "SCALE" | "REFRESH" | "REVIEW";

interface VerdictStyle {
  readonly label: string;
  readonly badgeClass: string;
  readonly borderClass: string;
}

/** Spec's `VERDICT_CONFIG`, adapted to the 5 real actionable verdicts (dropping the fabricated `GESER` entry) — the badge's own text color doubles as the "dot" the spec's screenshot shows, via the `●` glyph rendered inside `.verdictBadge`. */
function verdictStyle(verdict: string): VerdictStyle {
  switch (verdict as ActionableVerdict) {
    case "PAUSE":
      return {
        label: "Matikan",
        badgeClass: styles.badgePause ?? "",
        borderClass: styles.accentPause ?? "",
      };
    case "FIX":
      return {
        label: "Betulkan tujuan",
        badgeClass: styles.badgeFix ?? "",
        borderClass: styles.accentFix ?? "",
      };
    case "SCALE":
      return {
        label: "Naikkan budget",
        badgeClass: styles.badgeScale ?? "",
        borderClass: styles.accentScale ?? "",
      };
    case "REFRESH":
      return {
        label: "Refresh kreatif",
        badgeClass: styles.badgeRefresh ?? "",
        borderClass: styles.accentRefresh ?? "",
      };
    default:
      return {
        label: "Tinjau",
        badgeClass: styles.badgeReview ?? "",
        borderClass: styles.accentReview ?? "",
      };
  }
}

interface AdContext {
  readonly campaignStableId: string;
  readonly campaignObjective: string;
}

/** Every ad's parent campaign `stableId`/`objective` — the flat `data.ads` list (`CampaignAdDto`) carries neither, only `campaignName`, so this walks the real nested tree once to look them up (same traversal shape as `AuditClient.tsx`'s `flattenWithObjective`). */
function buildAdContext(data: AdAccountSummaryDto): ReadonlyMap<string, AdContext> {
  const map = new Map<string, AdContext>();
  for (const campaign of data.campaigns) {
    for (const adSet of campaign.adSets) {
      for (const ad of adSet.ads) {
        map.set(ad.id, {
          campaignStableId: campaign.stableId,
          campaignObjective: campaign.objective,
        });
      }
    }
  }
  return map;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Approximates an ad's creation date from `daysSinceCreation` (today minus N days) — a real,
 * derived value (not fabricated), only shown when the field is actually present. */
function approxCreatedDateLabel(daysSinceCreation: number | undefined): string | undefined {
  if (daysSinceCreation === undefined) {
    return undefined;
  }
  return formatDateId(new Date(Date.now() - daysSinceCreation * DAY_MS).toISOString());
}

function rpPerChat(spend: number, conversations: number): number | null {
  return conversations > 0 ? spend / conversations : null;
}

/** Card title per verdict (spec "Title format per verdict type"), using only real fields already on the ad — never a second, invented reason. */
function titleFor(ad: CampaignAdDto): string {
  const name = stripAdNameSuffix(ad.name);
  const dateLabel = approxCreatedDateLabel(ad.daysSinceCreation);
  switch (ad.verdict as ActionableVerdict) {
    case "PAUSE":
      return `Matikan ${ad.stableId} — ${name}${dateLabel !== undefined ? ` (${dateLabel})` : ""}`;
    case "FIX":
      return `Betulkan tujuan ${ad.stableId} — ${name}`;
    case "SCALE":
      // Real bug fix: the spec's own title format for SCALE omits the ad name entirely ("Naikkan
      // budget #C028 — sangat efisien") — kept here too, but with the real name appended, since
      // dropping an ad's identity from its own card would make it harder to tell two SCALE cards
      // apart at a glance.
      return `Naikkan budget ${ad.stableId} — ${name} (sangat efisien)`;
    case "REFRESH":
      return `Refresh kreatif ${ad.stableId} — ${name}`;
    default:
      return `Tinjau ${ad.stableId} — ${name}`;
  }
}

/** Card reason line per verdict (spec "Reason format per verdict type") — "Betulkan tujuan" shows
 * the ad's REAL parent-campaign `objective` (via `buildAdContext`), never the spec's own single
 * hardcoded example ("kunjungan profil IG"), since the real wrong objective varies per campaign. */
function reasonFor(ad: CampaignAdDto, ctx: AdContext | undefined): string {
  const rpChat = rpPerChat(ad.metrics.spend, ad.metrics.conversations);
  switch (ad.verdict as ActionableVerdict) {
    case "PAUSE":
      return rpChat !== null
        ? `${formatIdr(rpChat)}/chat terlalu mahal · belanja ${formatIdr(ad.metrics.spend)}`
        : `0 percakapan dari belanja ${formatIdr(ad.metrics.spend)}`;
    case "FIX":
      return `Saat ini optimasi ke ${ctx?.campaignObjective ?? "objective lain"}, bukan percakapan · belanja ${formatIdr(ad.metrics.spend)}`;
    case "SCALE":
      return `${rpChat !== null ? formatIdr(rpChat) : "—"}/chat · ${formatNumber(ad.metrics.conversations)} chat · kandidat kreatif evergreen`;
    case "REFRESH":
      return `Frequency ${ad.metrics.frequency.toFixed(1)} — audiens mulai jenuh · belanja ${formatIdr(ad.metrics.spend)}`;
    default:
      return rpChat !== null ? `Rp/chat ${formatIdr(rpChat)}` : "Belum ada percakapan tercatat.";
  }
}

/** "📝 ..." saving text per verdict (spec "Saving text format"). */
function savingFor(ad: CampaignAdDto): string {
  switch (ad.verdict as ActionableVerdict) {
    case "PAUSE":
      return `hemat ${formatIdr(ad.metrics.spend)}`;
    case "FIX":
      return `selamatkan ${formatIdr(ad.metrics.spend)}`;
    case "SCALE":
      return `potensi tambah ${formatNumber(ad.metrics.totalLead)} lead/bulan`;
    case "REFRESH":
      return "cegah penurunan performa";
    default:
      return `estimasi hemat ${formatIdr(ad.metrics.spend)}/bulan`;
  }
}

/** Sticky bar's "hemat est." rollup — only PAUSE/FIX have a real monetary saving (stopping/fixing
 * wasted spend); SCALE grows spend on purpose and REFRESH doesn't literally free up budget, so
 * neither contributes a Rupiah figure here (real bug fix — the pre-rebuild version counted every
 * non-SCALE verdict's full spend, which over-counted REFRESH). */
function estimatedSavings(ad: CampaignAdDto): number | null {
  return ad.verdict === "PAUSE" || ad.verdict === "FIX" ? ad.metrics.spend : null;
}

interface ExecuteResult {
  readonly targetId: string;
  readonly ok: boolean;
}

type FilterTab = "ALL" | "PENDING" | "PAUSE" | "FIX" | "SCALE" | "REFRESH";

const FILTER_TABS: ReadonlyArray<{ readonly key: FilterTab; readonly label: string }> = [
  { key: "ALL", label: "Semua" },
  { key: "PENDING", label: "Belum diputus" },
  { key: "PAUSE", label: "Matikan" },
  { key: "FIX", label: "Betulkan" },
  { key: "SCALE", label: "Scale" },
  { key: "REFRESH", label: "Refresh" },
];

type ChatEntry = LlmChatMessageDto & { readonly key: string };

const CHAT_PRESETS: readonly string[] = [
  "Apa 3 langkah paling mendesak minggu ini?",
  "Kalau budget bulan depan Rp10 juta, taruh di mana?",
  "Bagaimana cara menurunkan biaya per chat?",
  "Cabang mana yang sebaiknya difokuskan?",
  "Iklan mana yang harus dimatikan lebih dulu & kenapa?",
];

type ArahanState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "success"; readonly result: LlmAnalyzeResponseDto }
  | { readonly status: "no-key" }
  | { readonly status: "error" };

/**
 * "Strategi & Approve" page — Arahan Tamara (real AI narrative via `/api/llm/analyze`, same real
 * endpoint `AnalisaClient.tsx`'s "🤖 Analisa dengan AI" panel already calls), a KPI strip, a
 * Tamara chat widget (`/api/llm/chat`, same real endpoint/pattern as `SimulasiClient.tsx`'s
 * widget), filter tabs, and the verdict action list — every ad whose real `verdict` isn't `KEEP`,
 * approve/reject per item, then execute all approved items.
 *
 * Real deviations from the UI-rebuild spec this component follows (documented here since they
 * recur across several functions in this file):
 *   - No client-side `generateVerdicts()` — the spec proposed RE-COMPUTING PAUSE/FIX/SCALE from
 *     raw spend/conversations with its own thresholds (e.g. "> Rp25.000" for PAUSE), and even
 *     regenerating `stableId`s from array index. Both would risk silently disagreeing with the
 *     real, authoritative `VerdictEngine`/`StableIdAssigner` output `aaos-api` already computed —
 *     this page has always used (and continues to use) the real `ad.verdict`/`ad.stableId` fields,
 *     the same "never resort/recompute" discipline every other page in this app follows.
 *   - No "GESER" (shift budget) verdict/filter tab — not a real `Verdict` enum member (see
 *     `verdictStyle`'s docstring).
 *   - The spec's `POST /api/v1/verdicts/execute` (a bulk executor) doesn't exist on the real
 *     `aaos-api` — `POST /api/v1/verdicts` takes one `{ verdict, targetId, targetType }` per call,
 *     so "Execute Semua" still loops one request per approved ad (unchanged from the pre-rebuild
 *     version, coordinator note #6 below).
 *   - The spec's `/api/v1/llm/analyze` response shape (`{ arahan, temuan: { summary, findings } }`)
 *     doesn't match the real one (`{ temuan: [{icon,judul,detail}], rekomendasi: [...], ringkasan
 *     }`, already proven by `AnalisaClient.tsx`'s working "Analisa dengan AI" panel) — this reuses
 *     that real shape: `ringkasan` renders as the narrative "Arahan Tamara" paragraph, `temuan[]`
 *     as the "Temuan Utama" cards.
 *   - No multi-account ("Semua Akun"/pill selector) support in this pass — combining that with
 *     this page's existing per-snapshot (`fetchedAt`-keyed) approve/reject decision tracking is a
 *     real, separate design question (which account's decisions apply when merging two accounts'
 *     verdict lists?) that deserves its own scoped follow-up rather than a rushed answer here;
 *     this page still reads the single default cached account, same as before this rebuild.
 */
export function StrategiClient(): React.ReactElement {
  const { data, fetchedAt, loading, error, pull } = useCampaignsSnapshot();
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<readonly ExecuteResult[] | undefined>(undefined);
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [arahan, setArahan] = useState<ArahanState>({ status: "idle" });
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<readonly ChatEntry[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | undefined>(undefined);

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

  async function requestArahan(): Promise<void> {
    if (data === undefined) {
      return;
    }
    setArahan({ status: "loading" });
    try {
      const res = await fetch("/api/llm/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaigns: data.campaigns, totals: data.totals }),
      });
      if (res.status === 503) {
        setArahan({ status: "no-key" });
        return;
      }
      if (!res.ok) {
        setArahan({ status: "error" });
        return;
      }
      const result = (await res.json()) as LlmAnalyzeResponseDto;
      setArahan({ status: "success", result });
    } catch {
      setArahan({ status: "error" });
    }
  }

  async function sendChat(): Promise<void> {
    const content = chatInput.trim();
    if (content.length === 0) {
      return;
    }
    const userEntry: ChatEntry = { key: `user-${Date.now()}`, role: "user", content };
    const nextHistory = [...chatHistory, userEntry];
    setChatHistory(nextHistory);
    setChatInput("");
    setChatLoading(true);
    setChatError(undefined);
    try {
      const res = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: nextHistory.map(({ role, content: text }) => ({ role, content: text })),
          // A real, honest one-line summary of already-fetched data — not a fabricated
          // "campaign_summary" object the spec named but never defined the shape of.
          context:
            data !== undefined
              ? `meta-ads-strategi: total belanja ${formatIdr(data.totals.spend)}, ${formatNumber(data.adCount)} iklan, ${formatNumber(data.ads.filter((ad) => ad.verdict === "PAUSE").length)} PAUSE, ${formatNumber(data.ads.filter((ad) => ad.verdict === "FIX").length)} FIX, ${formatNumber(data.ads.filter((ad) => ad.verdict === "SCALE").length)} SCALE.`
              : "meta-ads-strategi",
        }),
      });
      if (!res.ok) {
        setChatError("Tamara tidak bisa menjawab saat ini.");
        return;
      }
      const result = (await res.json()) as { readonly reply: string };
      setChatHistory([
        ...nextHistory,
        { key: `assistant-${Date.now()}`, role: "assistant", content: result.reply },
      ]);
    } catch {
      setChatError("Tamara tidak bisa menjawab saat ini.");
    } finally {
      setChatLoading(false);
    }
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
      <div className={styles.page}>
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

  const adContext = buildAdContext(data);
  const actionable = data.ads.filter((ad) => ad.verdict !== "KEEP");
  const approvedCount = actionable.filter((ad) => decisions[ad.id] === "approved").length;
  const rejectedCount = actionable.filter((ad) => decisions[ad.id] === "rejected").length;
  const failedCount = results?.filter((result) => !result.ok).length ?? 0;
  const estimatedSavingsTotal = actionable
    .filter((ad) => decisions[ad.id] === "approved")
    .reduce((sum, ad) => sum + (estimatedSavings(ad) ?? 0), 0);

  const pauseCount = actionable.filter((ad) => ad.verdict === "PAUSE").length;
  const fixCount = actionable.filter((ad) => ad.verdict === "FIX").length;
  const scaleCount = actionable.filter((ad) => ad.verdict === "SCALE").length;
  // "Alihkan tanpa nambah budget" — the real, already-committed spend on PAUSE-verdict ads that
  // stopping frees up for reallocation elsewhere, without needing a bigger overall budget.
  const potensiHemat = actionable
    .filter((ad) => ad.verdict === "PAUSE")
    .reduce((sum, ad) => sum + ad.metrics.spend, 0);

  const filteredActionable = actionable.filter((ad) => {
    if (filter === "ALL") {
      return true;
    }
    if (filter === "PENDING") {
      return decisions[ad.id] === undefined;
    }
    return ad.verdict === filter;
  });

  return (
    <div className={styles.page}>
      <Header />

      <ArahanTamaraCard arahan={arahan} onRequest={() => void requestArahan()} />

      <IntelligenceSignalsCard />

      <section data-testid="strategi-kpi-strip" className={styles.kpiStrip}>
        <Kpi label="Total Usulan" value={formatNumber(actionable.length)} />
        <Kpi
          label="Potensi Hemat"
          value={formatIdrCompact(potensiHemat)}
          valueClass={styles.kpiValueGreen}
          hint="alihkan tanpa nambah budget"
        />
        <Kpi label="● Matikan" value={formatNumber(pauseCount)} valueClass={styles.kpiValueRed} />
        <Kpi label="⚙ Betulkan" value={formatNumber(fixCount)} />
        <Kpi label="● Scale" value={formatNumber(scaleCount)} valueClass={styles.kpiValueGreen} />
        <Kpi
          label="✓ Disetujui"
          value={formatNumber(approvedCount)}
          valueClass={styles.kpiValueGreen}
        />
      </section>

      <NgobrolTamaraCard
        history={chatHistory}
        loading={chatLoading}
        error={chatError}
        input={chatInput}
        onInputChange={setChatInput}
        onSend={() => void sendChat()}
      />

      {error !== undefined ? <ErrorCard message={error} /> : null}

      {actionable.length === 0 ? (
        <EmptyState
          title="Semua iklan sudah KEEP"
          description="Tidak ada rekomendasi yang perlu dieksekusi saat ini."
        />
      ) : (
        <>
          <div data-testid="strategi-filter-tabs" className={styles.filterTabs}>
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`${styles.filterTab} ${filter === tab.key ? styles.filterTabActive : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <ul data-testid="strategi-list" className={styles.list}>
            {filteredActionable.map((ad) => {
              const style = verdictStyle(ad.verdict);
              const decision = decisions[ad.id];
              const approved = decision === "approved";
              const rejected = decision === "rejected";
              const ctx = adContext.get(ad.id);
              return (
                <li key={ad.id} className={`${styles.card} ${style.borderClass}`}>
                  <div className={styles.cardHeaderRow}>
                    <span className={`${styles.verdictBadge} ${style.badgeClass}`}>
                      <span aria-hidden="true">●</span> {style.label}
                    </span>
                    <span className={styles.priorityBadge}>P1 · Iklan</span>
                    <span className={styles.idBadgeC}>{ad.stableId}</span>
                    {ctx !== undefined ? (
                      <span className={styles.idBadgeA}>{ctx.campaignStableId}</span>
                    ) : null}
                    {approved ? <span className={styles.stateApproved}>✅ Disetujui</span> : null}
                    {rejected ? <span className={styles.stateRejected}>❌ Ditolak</span> : null}
                  </div>

                  <p className={styles.cardTitle}>{titleFor(ad)}</p>
                  <p className={styles.cardReason}>{reasonFor(ad, ctx)}</p>

                  <div className={styles.cardFooter}>
                    <p className={styles.savingText}>
                      <span aria-hidden="true">📝</span> {savingFor(ad)}
                    </p>
                    {decision === undefined ? (
                      <div className={styles.decisionButtons}>
                        <button
                          type="button"
                          onClick={() => decide(ad.id, "rejected")}
                          className={styles.rejectButton}
                        >
                          Tolak
                        </button>
                        <button
                          type="button"
                          onClick={() => decide(ad.id, "approved")}
                          className={styles.approveButton}
                        >
                          ✓ Setujui
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setDecisions((prev) => {
                            const { [ad.id]: _removed, ...rest } = prev;
                            if (fetchedAt !== undefined) {
                              writeDecisions(fetchedAt, rest);
                            }
                            return rest;
                          })
                        }
                        data-testid={
                          approved ? `approved-badge-${ad.id}` : `rejected-badge-${ad.id}`
                        }
                        className={styles.undoButton}
                      >
                        ↩ Batalkan
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {actionable.length > 0 ? (
        <div className={styles.stickyBar}>
          <p className={styles.stickyText}>
            {approvedCount} disetujui · {rejectedCount} ditolak · hemat est.{" "}
            {formatIdr(estimatedSavingsTotal)}
          </p>
          <button
            type="button"
            onClick={() => void executeApproved(actionable)}
            disabled={executing || approvedCount === 0}
            className={styles.executeAllButton}
          >
            {executing ? "⏳ Mengeksekusi…" : `⚡ Execute Semua (${approvedCount})`}
          </button>
          {!executing && results !== undefined ? (
            <p data-testid="execute-summary" className={styles.stickyText}>
              {results.length - failedCount}/{results.length} berhasil dieksekusi
              {failedCount > 0 ? ` · ${failedCount} gagal` : ""}.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  valueClass,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly valueClass?: string;
  readonly hint?: string;
}): React.ReactElement {
  return (
    <div>
      <p className={styles.kpiLabel}>{label}</p>
      <p className={`${styles.kpiValue} ${valueClass ?? ""}`}>{value}</p>
      {hint !== undefined ? <p className={styles.kpiHint}>{hint}</p> : null}
    </div>
  );
}

function ArahanTamaraCard({
  arahan,
  onRequest,
}: {
  readonly arahan: ArahanState;
  readonly onRequest: () => void;
}): React.ReactElement {
  return (
    <section data-testid="strategi-arahan-card" className={styles.arahanCard}>
      <div className={styles.arahanHeader}>
        <div>
          <p className={styles.arahanTitle}>💬 Arahan Tamara</p>
          <p className={styles.arahanSubtitle}>
            Bahasa dirangkai AI dari angka &amp; vonis mesin — keputusan akhir tetap di tangan Anda.
          </p>
        </div>
        <button
          type="button"
          onClick={onRequest}
          disabled={arahan.status === "loading"}
          className={styles.arahanButton}
        >
          {arahan.status === "loading" ? "↻ Memperbarui…" : "↻ Minta Arahan Tamara"}
        </button>
      </div>

      {arahan.status === "idle" ? (
        <p className={styles.mutedText}>
          Tekan tombol di atas untuk arahan naratif. Daftar usulan di bawah tetap bisa langsung Anda
          Setujui/Tolak tanpa menunggu.
        </p>
      ) : null}
      {arahan.status === "no-key" ? (
        <ErrorCard message="Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings" />
      ) : null}
      {arahan.status === "error" ? (
        <ErrorCard message="Tamara tidak bisa merangkai arahan saat ini." />
      ) : null}
      {arahan.status === "success" ? (
        <div data-testid="strategi-arahan-result" className={styles.arahanResult}>
          <p className={styles.arahanText}>{arahan.result.ringkasan}</p>
          <p className={styles.arahanMeta}>Tamara (gpt-4o-mini) · angka &amp; vonis dari engine</p>
          {arahan.result.temuan.length > 0 ? (
            <div className={styles.temuanBlock}>
              <p className={styles.temuanTitle}>🔍 Temuan Utama</p>
              <ul className={styles.temuanList}>
                {arahan.result.temuan.map((item, index) => (
                  <li key={`${item.judul}-${index}`} className={styles.temuanItem}>
                    <span aria-hidden="true">{item.icon}</span> <strong>{item.judul}</strong> —{" "}
                    {item.detail}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function NgobrolTamaraCard({
  history,
  loading,
  error,
  input,
  onInputChange,
  onSend,
}: {
  readonly history: readonly ChatEntry[];
  readonly loading: boolean;
  readonly error: string | undefined;
  readonly input: string;
  readonly onInputChange: (value: string) => void;
  readonly onSend: () => void;
}): React.ReactElement {
  return (
    <section data-testid="tamara-chat-widget" className={styles.chatCard}>
      <div className={styles.chatHeader}>
        <p className={styles.chatHeaderTitle}>💬 Ngobrol dengan Tamara</p>
        <span className={styles.onlineDot}>● online</span>
      </div>
      <p className={styles.chatHeaderSubtitle}>
        Manager Iklan · memutuskan &amp; menyusun strategi bersama Anda.
      </p>

      {history.length === 0 ? (
        <p className={styles.chatIntro}>
          Saya Tamara, Manager Iklan Meta Anda. Tugas saya membantu memutuskan &amp; menyusun
          strategi — tanya apa saja soal data iklan ini.
        </p>
      ) : (
        <ul className={styles.chatHistory}>
          {history.map((entry) => (
            <li
              key={entry.key}
              className={`${styles.chatBubble} ${entry.role === "user" ? styles.chatBubbleUser : styles.chatBubbleAssistant}`}
            >
              {entry.content}
            </li>
          ))}
        </ul>
      )}

      <div className={styles.presetRow}>
        {CHAT_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onInputChange(preset)}
            className={styles.presetChip}
          >
            {preset}
          </button>
        ))}
      </div>

      {loading ? <p className={styles.mutedText}>Tamara sedang mengetik…</p> : null}
      {error !== undefined ? <ErrorCard message={error} /> : null}

      <div className={styles.chatInputRow}>
        <input
          type="text"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Tanya soal strategi / keputusan iklan…"
          aria-label="Tanya Tamara"
          className={styles.chatInput}
        />
        <button
          type="button"
          onClick={onSend}
          disabled={loading}
          aria-label="Kirim"
          className={styles.chatSendButton}
        >
          ▶
        </button>
      </div>
    </section>
  );
}

function Header(): React.ReactElement {
  return (
    <div>
      <p className={styles.breadcrumb}>AAOS › Tamara › Strategi &amp; Approve</p>
      <h2 className={styles.title}>Strategi &amp; Approve</h2>
      <p className={styles.subtitle}>
        Arahan Tamara + eksekusi verdict — keputusan akhir ada di tangan Anda.
      </p>
    </div>
  );
}
