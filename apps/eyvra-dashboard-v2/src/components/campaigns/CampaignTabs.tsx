"use client";
import Link from "next/link";
import { CampaignPerformancePreview } from "./CampaignPerformancePreview";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Card } from "@/components/common/Card";
import { Drawer } from "@/components/common/Drawer";
import { formatIdrCompact, formatRelativeTimeId } from "@/lib/formatters";
import { presentLabel, presentText } from "@/lib/presentation";
import {
  recordedChanges,
  linkedPackages,
  experimentProgress,
  type WorkspaceData,
  type CampaignPackage,
  type CampaignExperiment,
  type CampaignActivity,
} from "@/lib/campaign-workspace";
import type { CampaignView, HistoryPoint } from "@/lib/campaigns";
import {
  CREATIVE_HEALTH_STATES,
  buildCreativeGallery,
  buildSamanthaCreativeAnalysis,
  creativeAngleOptions,
  creativeFormatDistribution,
  creativeFormatOptions,
  creativeHealthCounts,
  creativeInsights,
  filterCreativeGallery,
  sortCreativeGallery,
  type CreativeFormat,
  type CreativeHealthStatus,
  type CreativeSortKey,
} from "@/lib/creative-health";
import {
  buildLeadFunnel,
  buildSamanthaLeadQualityAnalysis,
  leadQualityInsights,
  leadQualityTrend,
  MIN_LEAD_SAMPLE,
  type LeadFunnelStage,
} from "@/lib/lead-quality";
import {
  budgetInsights,
  computeBudgetPacing,
  computeFatiguedSpendWaste,
  mapSamanthaBudgetDecision,
} from "@/lib/budget";
import {
  archivedExperiments,
  buildSamanthaExperimentRecommendation,
  EXPERIMENT_TEMPLATES,
  experimentLearnings,
  experimentOverviewCounts,
  experimentResultLabel,
  experimentResultsSummary,
  filterExperiments,
  presentExperimentStatus,
  RPH_LEAD_LABEL,
  sortExperiments,
  variantRphLead,
  winningVariant,
  type ExperimentSortKey,
  type ExperimentStatusFilter,
} from "@/lib/experiments";
import styles from "./CampaignTabs.module.css";
const money = (n?: number) => (n === undefined || !Number.isFinite(n) ? "—" : formatIdrCompact(n));
const date = (s: string) =>
  new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
/**
 * Samantha's recommended POSTURE per health state — text only, never a button that claims to pause
 * or rotate anything. This codebase has no real, Learning-Guardian-gated "apply" endpoint for these
 * actions yet (deferred to the Creative Health Second Boundary), so presenting them as a working
 * control would be exactly the "action rail with no real effect" anti-pattern this app avoids
 * everywhere else. The two REAL, working actions ("Send to Kai", "Explore Variants") are still
 * rendered as real buttons, shown only where they're contextually meaningful for the state.
 */
const STATUS_POSTURE: Record<CreativeHealthStatus, string> = {
  Winner: "Keep Running",
  Healthy: "Keep Running",
  Watch: "Monitor Closely",
  Fatigued: "Pause / Rotate",
  Loser: "Pause / Replace",
  "Insufficient Data": "Observe",
  Unassessed: "Observe",
};
function statusCardActions(status: CreativeHealthStatus) {
  return {
    showSendToKai: status === "Fatigued" || status === "Loser",
    showExploreVariants: status === "Winner" || status === "Healthy",
  };
}
function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.empty}>
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}
function Media({ image, video, name }: { image?: string; video?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image, video]);
  return (
    <div className={styles.media}>
      {!failed && video ? (
        <video
          controls
          preload="metadata"
          poster={image}
          src={video}
          onError={() => setFailed(true)}
          aria-label={name}
        />
      ) : !failed && image ? (
        // eslint-disable-next-line @next/next/no-img-element -- tenant-owned and Meta media
        <img src={image} alt={name} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span>
          ▧<small>Preview belum tersedia</small>
        </span>
      )}
    </div>
  );
}
function Stats({ values }: { values: [string, React.ReactNode][] }) {
  return (
    <div className={styles.stats}>
      {values.map(([label, value]) => (
        <div key={label}>
          <small>{label}</small>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}
function Plot({
  values,
  labels,
  title,
  monetary = false,
  annotations = [],
}: {
  values: number[];
  labels: string[];
  title: string;
  monetary?: boolean;
  annotations?: { date: string; label: string }[];
}) {
  if (values.length < 2)
    return (
      <Empty title="Belum cukup data">
        Minimal dua snapshot diperlukan untuk menampilkan {title.toLowerCase()}.
      </Empty>
    );
  const max = Math.max(1, ...values);
  const x = (i: number) => 60 + (i / (values.length - 1)) * 640;
  return (
    <svg viewBox="0 0 740 240" className={styles.chart} role="img" aria-label={title}>
      <title>{title}</title>
      {[0, 0.5, 1].map((n) => (
        <g key={n}>
          <line x1="60" x2="700" y1={190 - 150 * n} y2={190 - 150 * n} stroke="var(--border)" />
          <text x="3" y={194 - 150 * n}>
            {monetary
              ? money(max * n)
              : (max * n).toLocaleString("id-ID", { maximumFractionDigits: 2 })}
          </text>
        </g>
      ))}
      <polyline
        points={values.map((v, i) => `${x(i)},${190 - (v / max) * 150}`).join(" ")}
        fill="none"
        stroke="var(--brand)"
        strokeWidth="2.5"
      />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={190 - (v / max) * 150} r="3" fill="var(--brand)">
          <title>
            {labels[i]}: {monetary ? money(v) : v.toLocaleString("id-ID")}
          </title>
        </circle>
      ))}
      {annotations.map((a, i) => {
        const idx = labels.indexOf(a.date.slice(0, 10));
        return idx < 0 ? null : (
          <g key={i}>
            <line
              x1={x(idx)}
              x2={x(idx)}
              y1="25"
              y2="190"
              stroke="var(--primary-cyan)"
              strokeDasharray="4 4"
            />
            <circle cx={x(idx)} cy="25" r="5" fill="var(--brand)">
              <title>{a.label}</title>
            </circle>
          </g>
        );
      })}
      <text x="60" y="222">
        {labels[0]}
      </text>
      <text x="615" y="222">
        {labels.at(-1)}
      </text>
    </svg>
  );
}
function Timeline({ activities }: { activities: CampaignActivity[] }) {
  const [agent, setAgent] = useState("ALL");
  const filtered = activities.filter((a) => agent === "ALL" || a.agent.toUpperCase() === agent);
  return (
    <>
      <div className={styles.sectionHead}>
        <h3>Decision → execution → result</h3>
        <select aria-label="History agent" value={agent} onChange={(e) => setAgent(e.target.value)}>
          {["ALL", "SAMANTHA", "KAI", "META", "USER", "CLARA"].map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </div>
      {filtered.length ? (
        <ol className={styles.timeline}>
          {filtered.map((a) => (
            <li key={a.id}>
              <span className={styles.tag}>
                {a.agent} · {presentLabel(a.status)}
              </span>
              <time>{date(a.createdAt)}</time>
              <h3>{presentLabel(a.actionType)}</h3>
              <p>{a.reasoning ? presentText(a.reasoning) : "Tidak ada catatan keputusan."}</p>
              <div className={styles.steps}>
                <span>
                  Decision
                  <br />
                  <b>{a.reasoning ? "Recorded" : "Unavailable"}</b>
                </span>
                <span>
                  Execution
                  <br />
                  <b>{presentLabel(a.status)}</b>
                </span>
                <span>
                  Result
                  <br />
                  <b>{a.completedAt ? date(a.completedAt) : "Belum selesai"}</b>
                </span>
              </div>
              {a.errorMessage && (
                <p role="status">Eksekusi gagal. Periksa detail aktivitas sebelum mencoba ulang.</p>
              )}
              <details>
                <summary>Catatan perubahan</summary>
                {[a.input, a.output, ...a.toolCalls.flatMap((t) => [t.input, t.output])]
                  .flatMap(recordedChanges)
                  .map((change, i) => (
                    <p key={i}>
                      <b>{presentLabel(change.metric)}</b>: {change.before} → {change.after}
                    </p>
                  ))}
                {a.toolCalls.length ? (
                  a.toolCalls.map((t, i) => (
                    <p key={i}>
                      {presentLabel(t.tool)} · {date(t.at)}
                    </p>
                  ))
                ) : (
                  <p>Before/after tidak direkam untuk aktivitas ini.</p>
                )}
              </details>
            </li>
          ))}
        </ol>
      ) : (
        <Empty title="Belum ada aktivitas yang terhubung">
          Riwayat hanya memuat event dengan referensi campaign yang cocok dari 500 aktivitas
          terbaru. Tidak ada perubahan yang dianggap sudah dieksekusi hanya berdasarkan rekomendasi.
        </Empty>
      )}
    </>
  );
}
/**
 * One experiment row's real control-vs-variant thumbnail comparison — reuses the real `Media`
 * component and real `imageUrl`/`videoUrl` per variant already fetched for the card gallery, just
 * in compact table-row framing. First variant is presented as the reference ("control"); the ab-
 * testing domain doesn't explicitly designate one, so this is an honest labeling, not a real flag.
 */
function VariantThumbPair({ test }: { test: CampaignExperiment }) {
  return (
    <div className={styles.thumbPair}>
      {test.variants.slice(0, 2).map((v, i) => (
        <Media
          key={v.id}
          image={v.imageUrl}
          video={v.videoUrl}
          name={`${i === 0 ? "Control" : "Variant"} · ${v.variantLabel}`}
        />
      ))}
    </div>
  );
}
export function CampaignTabs({
  item,
  tab,
  onTab,
  history,
  historyError,
  creativeRailSlot,
}: {
  item: CampaignView;
  tab: string;
  onTab: (tab: string) => void;
  history?: HistoryPoint[];
  historyError: boolean;
  /**
   * A DOM node inside the page's one real right rail (`CampaignDetailV2`'s `<aside>`) that the
   * Creative Health tab's own rail sections portal into, so they render as an extension of that
   * SAME rail instead of a second, narrower nested column. `undefined`/`null` (not yet mounted, or
   * `CampaignTabs` rendered standalone e.g. in a test) falls back to rendering those sections
   * inline — nothing is lost, it just isn't flush with the page rail in that case.
   */
  creativeRailSlot?: HTMLDivElement | null;
}) {
  const [data, setData] = useState<WorkspaceData>();
  const [loadError, setLoadError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [metric, setMetric] = useState<"spend" | "leads" | "ctr" | "cpl">("spend");
  const [range, setRange] = useState(30);
  const [health, setHealth] = useState("All");
  const [brief, setBrief] = useState(false);
  const [variant, setVariant] = useState<CampaignPackage>();
  const [angle, setAngle] = useState("INVESTASI");
  const [message, setMessage] = useState("");
  const [format, setFormat] = useState("IMAGES_ONLY");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [creativeSearch, setCreativeSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState<CreativeFormat | "All">("All");
  const [angleFilter, setAngleFilter] = useState("All");
  const [sortKey, setSortKey] = useState<CreativeSortKey>("performance");
  const [view, setView] = useState<"card" | "table">("card");
  const [detailId, setDetailId] = useState<string>();
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [showLeadFullAnalysis, setShowLeadFullAnalysis] = useState(false);
  const [leadStatusFilter, setLeadStatusFilter] = useState("All");
  const [leadTempFilter, setLeadTempFilter] = useState("All");
  const [experimentSearch, setExperimentSearch] = useState("");
  const [experimentStatusFilter, setExperimentStatusFilter] =
    useState<ExperimentStatusFilter>("All");
  const [experimentSortKey, setExperimentSortKey] = useState<ExperimentSortKey>("progress");
  const [showArchivedExperiments, setShowArchivedExperiments] = useState(false);
  const [experimentDetailId, setExperimentDetailId] = useState<string>();
  useEffect(() => {
    const controller = new AbortController();
    setData(undefined);
    setLoadError(false);
    fetch(`/api/campaigns/${encodeURIComponent(item.campaign.metaId)}/workspace`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<WorkspaceData>;
      })
      .then((body) => {
        if (!controller.signal.aborted) setData(body);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, [item.campaign.metaId, revision]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  useEffect(() => {
    const controller = new AbortController();
    setThumbnails({});
    const refs = item.campaign.adSets
      .flatMap((s) => s.ads.flatMap((a) => (a.creativeAsset ? [a.creativeAsset] : [])))
      .slice(0, 50);
    if (refs.length)
      fetch("/api/creative/thumbnails", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refs, adAccountId: item.campaign.accountId }),
        signal: controller.signal,
      })
        .then(async (r) => {
          if (r.ok) {
            const body = await r.json();
            if (!controller.signal.aborted) setThumbnails(body.thumbnails ?? {});
          }
        })
        .catch(() => {});
    return () => controller.abort();
  }, [item.campaign.metaId, item.campaign.accountId, item.campaign.adSets]);
  const ads = item.campaign.adSets.flatMap((s) => s.ads);
  const tests = data?.tests ?? [];
  const activities = data?.activities ?? [];
  const packages = useMemo(
    () =>
      linkedPackages(
        data?.packages ?? [],
        item.campaign.adSets.flatMap((s) => s.ads.map((a) => a.metaId)),
        data?.tests ?? [],
        data?.listingId,
      ),
    [data, item.campaign.adSets],
  );
  const points = (history ?? []).slice(-range);
  const labels = points.map((p) => p.date);
  const vals = points.map((p) => (metric === "ctr" ? p.ctr * 100 : p[metric]));
  const leads = data?.leads;
  const qualified = leads?.filter((l) => l.temperature === "HOT").length;
  const events = activities.map((a) => ({
    date: a.createdAt,
    label: `${a.agent}: ${presentLabel(a.actionType)}`,
  }));
  const lastSeven = (history ?? []).slice(-7);
  const average = lastSeven.length
    ? lastSeven.reduce((sum, p) => sum + p.spend, 0) / lastSeven.length
    : undefined;
  const budgetEvents = activities.filter((a) => /BUDGET|SCALE|ROLLBACK/i.test(a.actionType));
  const gallery = buildCreativeGallery(
    ads,
    packages,
    tests,
    item.assessment?.representativeCreative,
    thumbnails,
  );
  const healthCounts = creativeHealthCounts(gallery);
  const formatOptions = creativeFormatOptions(gallery);
  const angleOptions = creativeAngleOptions(gallery);
  const visibleGallery = sortCreativeGallery(
    filterCreativeGallery(gallery, {
      search: creativeSearch,
      status: health as CreativeHealthStatus | "All",
      format: formatFilter,
      angle: angleFilter,
    }),
    sortKey,
  );
  const detailItem = gallery.find((g) => g.ad.metaId === detailId);
  const insights = creativeInsights(gallery);
  const distribution = creativeFormatDistribution(gallery);
  const maxDistribution = Math.max(1, ...distribution.map((d) => d.count));
  const linkedPackage = gallery.find((g) => g.pkg)?.pkg;
  const fatiguedCount = healthCounts.Fatigued;
  const analysis = buildSamanthaCreativeAnalysis(gallery, healthCounts, insights);
  const leadFunnel = buildLeadFunnel(leads);
  const leadAnalysis = buildSamanthaLeadQualityAnalysis(leads);
  const leadTrend = leadQualityTrend(leads);
  const leadInsights = leadQualityInsights(leads);
  const visibleLeads = (leads ?? []).filter(
    (l) =>
      (leadStatusFilter === "All" || l.status === leadStatusFilter) &&
      (leadTempFilter === "All" || l.temperature === leadTempFilter),
  );
  const leadStatusOptions = [...new Set((leads ?? []).map((l) => l.status))].sort();
  const leadTempOptions = [...new Set((leads ?? []).map((l) => l.temperature))].sort();
  const budgetDecision = mapSamanthaBudgetDecision(item);
  const budgetPacing = computeBudgetPacing(item, history);
  const potentialWaste = computeFatiguedSpendWaste(gallery);
  const budgetHotLeadRate =
    leads && leads.length >= MIN_LEAD_SAMPLE
      ? leads.filter((l) => l.temperature === "HOT").length / leads.length
      : undefined;
  const budgetInsightList = budgetInsights(budgetPacing, budgetDecision);
  const experimentOverview = experimentOverviewCounts(tests);
  const experimentResults = experimentResultsSummary(tests);
  const experimentLearningList = experimentLearnings(tests);
  const experimentRecommendation = buildSamanthaExperimentRecommendation(tests, angleOptions);
  const experimentSourceList = showArchivedExperiments ? archivedExperiments(tests) : tests;
  const visibleExperiments = sortExperiments(
    filterExperiments(experimentSourceList, {
      search: experimentSearch,
      status: experimentStatusFilter,
    }),
    experimentSortKey,
  );
  const experimentDetail = tests.find((t) => t.id === experimentDetailId);
  async function sendBrief() {
    setSaving(true);
    setNotice("");
    try {
      const r = await fetch(`/api/campaigns/${encodeURIComponent(item.campaign.metaId)}/brief`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ angle, message, format }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error?.message ?? "Brief gagal disimpan");
      setNotice("Brief tersimpan sebagai Draft di Kai. Belum ada generation atau publikasi iklan.");
      setRevision((n) => n + 1);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Brief gagal disimpan");
    } finally {
      setSaving(false);
    }
  }
  const trend = (
    <Card>
      <div className={styles.sectionHead}>
        <div>
          <h3>Performance Trend</h3>
          <small>Daily snapshots · {range} titik terakhir</small>
        </div>
        <div className={styles.controls}>
          {tab !== "overview" && (
            <select
              aria-label="Trend metric"
              value={metric}
              onChange={(e) => setMetric(e.target.value as typeof metric)}
            >
              <option value="spend">Spend</option>
              <option value="leads">Raw Leads</option>
              <option value="ctr">CTR (%)</option>
              <option value="cpl">CPL</option>
            </select>
          )}
          <select
            aria-label="Trend range"
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
        </div>
      </div>
      {historyError ? (
        <Empty title="Riwayat gagal dimuat">Muat ulang halaman untuk mencoba kembali.</Empty>
      ) : !history ? (
        <p>Memuat riwayat…</p>
      ) : tab === "overview" ? (
        <CampaignPerformancePreview points={points} events={events} />
      ) : (
        <Plot
          values={vals}
          labels={labels}
          title={`${presentLabel(metric)} trend`}
          monetary={metric === "spend" || metric === "cpl"}
          annotations={events}
        />
      )}
    </Card>
  );
  const funnel = (
    <Card>
      <h3>Lead Funnel · Clara + CRM</h3>
      <p className={styles.muted}>
        Raw/Contacted/Qualified/Hot dihitung dari lead teratribusi. Qualified = temperature WARM
        atau HOT; Hot = temperature HOT. Appointment, Survey, dan Booking memerlukan integrasi
        Respon Pintar yang belum terhubung.
      </p>
      {leadFunnel.map((stage: LeadFunnelStage) => (
        <div className={styles.funnel} key={stage.key}>
          <span>{stage.label}</span>
          <b>{stage.value ?? "—"}</b>
          <span className={styles.muted}>
            {stage.dropOffPct !== undefined
              ? stage.dropOffPct >= 0
                ? `-${stage.dropOffPct}%`
                : `+${Math.abs(stage.dropOffPct)}%`
              : "—"}
          </span>
          <div>
            <i
              style={{
                width:
                  typeof stage.value === "number" && leads?.length
                    ? `${(stage.value / leads.length) * 100}%`
                    : "0%",
              }}
            />
          </div>
        </div>
      ))}
      {leads?.length === 0 && (
        <p className={styles.muted}>
          Belum ada lead dengan campaign ID ini. Angka Meta dan CRM belum bisa direkonsiliasi.
        </p>
      )}
    </Card>
  );
  const creativeSummary = (
    <Card>
      <h3>Creative Health Summary</h3>
      <div className={styles.healthCounts}>
        {CREATIVE_HEALTH_STATES.map((status) => (
          <div key={status} data-health={status}>
            <b>{healthCounts[status]}</b>
            <small>{status === "Unassessed" ? "Belum dinilai" : status}</small>
          </div>
        ))}
      </div>
      <div className={styles.previewStrip}>
        {gallery.slice(0, 5).map((g) => (
          <div key={g.ad.metaId}>
            <Media image={g.image} video={g.video} name={g.ad.name} />
            <small>{g.status === "Unassessed" ? "Belum dinilai" : g.status}</small>
            <small className={styles.previewName}>{g.ad.name}</small>
          </div>
        ))}
      </div>
      <button onClick={() => onTab("creative")}>Explore creative health →</button>
    </Card>
  );
  return (
    <div className={`${styles.workspace} ${tab === "overview" ? styles.overviewV2 : ""}`}>
      {loadError || data?.errors.length ? (
        <div role="status" className={styles.warning}>
          {loadError ? "Data pendukung gagal dimuat." : data?.errors.join(" ")}{" "}
          <button onClick={() => setRevision((n) => n + 1)}>Retry workspace data</button>
        </div>
      ) : (
        !data && <p role="status">Memuat lead, eksperimen, Kai, dan history…</p>
      )}
      {tab === "overview" && (
        <>
          <div className={styles.twoCol}>
            {trend}
            {creativeSummary}
            <Card>
              <h3>Lead Quality Snapshot</h3>
              <p className={styles.muted}>CRM teratribusi · sepanjang waktu</p>
              <Stats
                values={[
                  [
                    "Hot Lead Rate",
                    leads?.length
                      ? (((qualified ?? 0) / leads.length) * 100).toFixed(1) + "%"
                      : "—",
                  ],
                  ["Appointment Rate", "—"],
                  ["Booking Rate", "—"],
                ]}
              />
              <p className={styles.muted}>
                Appointment dan booking belum tersedia. HOT tidak disamakan dengan booking.
              </p>
              <button onClick={() => onTab("leads")}>Lihat lead quality →</button>
            </Card>
            <Card>
              <h3>Tracking Guardian</h3>
              <Stats
                values={[
                  ["Meta Pixel", "Belum terhubung"],
                  ["CAPI", "Belum terhubung"],
                  ["WhatsApp Attribution", "Belum terkonfirmasi"],
                  ["CRM Feedback", leads ? "Data lead tersedia" : "Belum tersedia"],
                ]}
              />
              <p className={styles.muted}>
                Status event dan reliabilitas tracking belum disediakan. Tidak ada status Pass yang
                diasumsikan.
              </p>
            </Card>
          </div>
        </>
      )}
      {tab === "performance" && (
        <>
          <div className={styles.observation}>
            <b>✧ Samantha observation</b>
            <p>
              {item.assessment?.diagnosis.evidence.map((e) => e.reasoning).join(" ") ||
                "Belum ada observasi yang cukup untuk campaign ini."}
            </p>
          </div>
          {trend}
          <Card>
            <h3>Action annotations</h3>
            {events.length ? (
              events.map((e, i) => (
                <p key={i}>
                  {date(e.date)} · {e.label}
                </p>
              ))
            ) : (
              <p className={styles.muted}>
                Belum ada tindakan teratribusi untuk ditandai pada grafik.
              </p>
            )}
          </Card>
          <Card>
            <h3>Ad set breakdown</h3>
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    {["Ad set", "Status", "Spend", "Leads", "CPL", "CTR"].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {item.campaign.adSets.map((s) => {
                    const spend = s.ads.reduce((n, a) => n + a.metrics.spend, 0),
                      leads = s.ads.reduce((n, a) => n + a.metrics.totalLead, 0),
                      clicks = s.ads.reduce((n, a) => n + a.metrics.clicks, 0),
                      impressions = s.ads.reduce((n, a) => n + (a.metrics.impressions ?? 0), 0);
                    return (
                      <tr key={s.metaId}>
                        <td>{s.name}</td>
                        <td>{presentLabel(s.status)}</td>
                        <td>{money(spend)}</td>
                        <td>{leads}</td>
                        <td>{money(leads ? spend / leads : undefined)}</td>
                        <td>
                          {impressions ? `${((clicks / impressions) * 100).toFixed(2)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <h3>Placement breakdown</h3>
            <Empty title="Placement belum tersedia">
              Snapshot saat ini berisi total ad dan ad set; distribusi Facebook, Instagram, Feed,
              dan Reels belum dilaporkan.
            </Empty>
          </Card>
        </>
      )}
      {tab === "creative" && (
        <>
          <div className={styles.heroRow} data-testid="creative-hero">
            <div className={styles.heroLeft}>
              <span className={styles.heroAvatar} aria-hidden="true">
                ✧
              </span>
              <div className={styles.heroLeftBody}>
                <div className={styles.heroTitleRow}>
                  <b>Samantha&apos;s Creative Analysis</b>
                  <span className={styles.heroPosture} data-posture={analysis.posture}>
                    {analysis.posture}
                  </span>
                  <small>Diperbarui {formatRelativeTimeId(item.campaign.syncedAt)}</small>
                </div>
                <p>{analysis.summary}</p>
                <p>{analysis.recommendation}</p>
              </div>
            </div>
            <div className={styles.heroRight}>
              <div className={styles.heroRightHead}>
                <b>◆ Key Insight</b>
                <button
                  disabled={!item.assessment}
                  title={!item.assessment ? "Assessment campaign belum tersedia" : undefined}
                  onClick={() => setShowFullAnalysis(true)}
                >
                  View Full Analysis →
                </button>
              </div>
              {analysis.keyInsights.length ? (
                <ul className={styles.insightList}>
                  {analysis.keyInsights.map((text, i) => (
                    <li key={i}>{text}</li>
                  ))}
                </ul>
              ) : (
                <p className={styles.muted}>
                  Belum cukup data untuk insight. Minimal 2 creative dengan delivery diperlukan.
                </p>
              )}
            </div>
          </div>
          <div className={styles.healthCounts}>
            {CREATIVE_HEALTH_STATES.map((status) => {
              const count = healthCounts[status];
              const pct = gallery.length ? Math.round((count / gallery.length) * 100) : 0;
              return (
                <button
                  type="button"
                  key={status}
                  className={styles.stateCard}
                  data-health={status}
                  aria-pressed={health === status}
                  aria-label={`${status} ${count} (${pct}%)`}
                  onClick={() => setHealth(health === status ? "All" : status)}
                >
                  <span className={styles.stateLabel}>{status}</span>
                  <span className={styles.stateCount}>
                    {count}
                    <small>{pct}%</small>
                  </span>
                  <span className={styles.stateBar}>
                    <i style={{ width: `${pct}%` }} />
                  </span>
                </button>
              );
            })}
          </div>
          <div className={styles.toolbar}>
            <input
              type="search"
              aria-label="Cari creative"
              placeholder="Cari ID, nama, atau angle…"
              value={creativeSearch}
              onChange={(e) => setCreativeSearch(e.target.value)}
            />
            <select
              aria-label="Filter status"
              value={health}
              onChange={(e) => setHealth(e.target.value)}
            >
              <option value="All">All Status</option>
              {CREATIVE_HEALTH_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter format"
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value as CreativeFormat | "All")}
            >
              <option value="All">All Format</option>
              {formatOptions.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter angle"
              value={angleFilter}
              onChange={(e) => setAngleFilter(e.target.value)}
            >
              <option value="All">All Angle</option>
              {angleOptions.map((a) => (
                <option key={a} value={a}>
                  {presentLabel(a)}
                </option>
              ))}
            </select>
            <select
              aria-label="Urutkan"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as CreativeSortKey)}
            >
              <option value="performance">Sort by: Performance</option>
              <option value="ctr">Sort by: CTR</option>
              <option value="cpl">Sort by: CPL</option>
              <option value="spend">Sort by: Spend</option>
            </select>
            <div className={styles.viewToggle}>
              <button aria-pressed={view === "card"} onClick={() => setView("card")}>
                Card View
              </button>
              <button aria-pressed={view === "table"} onClick={() => setView("table")}>
                Table View
              </button>
            </div>
            <button
              className={styles.primaryAction}
              onClick={() => {
                setBrief(true);
                setNotice("");
              }}
            >
              ＋ Request Creatives from Kai
            </button>
          </div>
          {view === "card" ? (
            <div className={styles.gallery}>
              {visibleGallery.map((g) => {
                const { showSendToKai, showExploreVariants } = statusCardActions(g.status);
                return (
                  <article key={g.ad.metaId} className={styles.creative}>
                    <div className={styles.mediaFrame}>
                      <Media image={g.image} video={g.video} name={g.ad.name} />
                      <span
                        className={styles.mediaHealth}
                        data-health={g.status}
                        data-testid="card-health-pill"
                      >
                        {g.status}
                      </span>
                      <span
                        className={styles.mediaMetaStatus}
                        data-status={g.ad.status}
                        data-testid="card-meta-status-pill"
                      >
                        <i />
                        {presentLabel(g.ad.status)}
                      </span>
                      <span className={styles.mediaCaption}>{g.ad.headline || g.ad.name}</span>
                    </div>
                    <div className={styles.creativeBody}>
                      <h3>
                        {g.ad.stableId} · {g.ad.headline || g.ad.name}
                      </h3>
                      <div className={styles.chips}>
                        <span className={styles.chip}>{g.format}</span>
                        <span className={styles.chip}>
                          {g.angle ? presentLabel(g.angle) : "Angle belum tercatat"}
                        </span>
                      </div>
                      <div className={styles.creativeMetrics}>
                        {[
                          ["CTR", g.ctr !== undefined ? `${(g.ctr * 100).toFixed(2)}%` : "—"],
                          ["CPL", money(g.cpl)],
                          ["CPQL", "—"],
                          ["Frequency", g.frequency?.toFixed(2) ?? "—"],
                          ["Leads", g.leads],
                          ["Hot Lead Rate", "—"],
                        ].map(([label, value]) => (
                          <div key={label as string}>
                            <small>{label}</small>
                            <strong>{value}</strong>
                          </div>
                        ))}
                      </div>
                      <div className={styles.creativeFooter}>
                        <span className={styles.posture} data-health={g.status}>
                          {STATUS_POSTURE[g.status]}
                        </span>
                        <div className={styles.controls}>
                          {showSendToKai && (
                            <button
                              onClick={() => {
                                setMessage(
                                  `Refresh ${g.ad.stableId}: ${g.ad.headline || g.ad.name}. ${item.issue}.`,
                                );
                                setBrief(true);
                                setNotice("");
                              }}
                            >
                              Send to Kai
                            </button>
                          )}
                          {showExploreVariants && (
                            <button
                              disabled={!g.pkg}
                              title={!g.pkg ? "Belum ada paket Kai yang terhubung" : undefined}
                              onClick={() => setVariant(g.pkg)}
                            >
                              Explore Variants
                            </button>
                          )}
                          <button onClick={() => setDetailId(g.ad.metaId)}>View Details</button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    {[
                      "Creative",
                      "Health",
                      "Meta status",
                      "Format",
                      "Angle",
                      "CTR",
                      "CPL",
                      "Frequency",
                      "Leads",
                      "Spend",
                      "",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleGallery.map((g) => (
                    <tr key={g.ad.metaId}>
                      <td>
                        {g.ad.stableId} · {g.ad.headline || g.ad.name}
                      </td>
                      <td>
                        <span className={styles.tag} data-health={g.status}>
                          {g.status}
                        </span>
                      </td>
                      <td>{presentLabel(g.ad.status)}</td>
                      <td>{g.format}</td>
                      <td>{g.angle ? presentLabel(g.angle) : "—"}</td>
                      <td>{g.ctr !== undefined ? `${(g.ctr * 100).toFixed(2)}%` : "—"}</td>
                      <td>{money(g.cpl)}</td>
                      <td>{g.frequency?.toFixed(2) ?? "—"}</td>
                      <td>{g.leads}</td>
                      <td>{money(g.spend)}</td>
                      <td>
                        <button onClick={() => setDetailId(g.ad.metaId)}>Detail</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!visibleGallery.length && (
            <Empty title="Tidak ada creative sesuai filter">
              Ubah pencarian, status, format, atau angle untuk melihat creative campaign ini.
            </Empty>
          )}
          {(() => {
            const railContent = (
              <>
                <Card>
                  <h3>Creative Actions</h3>
                  <div className={styles.stack}>
                    <button
                      onClick={() => {
                        setBrief(true);
                        setNotice("");
                      }}
                    >
                      Send to Kai for New Concepts
                    </button>
                    <button
                      disabled={!linkedPackage}
                      title={!linkedPackage ? "Belum ada paket Kai yang terhubung" : undefined}
                      onClick={() => setVariant(linkedPackage)}
                    >
                      Explore Variants
                    </button>
                    <button onClick={() => onTab("experiments")}>A/B Test New Angles</button>
                    <button
                      disabled={!fatiguedCount}
                      title={!fatiguedCount ? "Tidak ada creative fatigued saat ini" : undefined}
                      onClick={() => {
                        setMessage(
                          `Refresh ${fatiguedCount} creative fatigued pada campaign ini. ${item.issue}.`,
                        );
                        setBrief(true);
                        setNotice("");
                      }}
                    >
                      Refresh Fatigued Creatives ({fatiguedCount})
                    </button>
                  </div>
                  <p className={styles.muted}>
                    A/B Test membuka tab Experiments campaign ini. Refresh Fatigued mengisi brief
                    Kai dengan jumlah creative fatigued saat ini — belum ada automasi replacement.
                  </p>
                </Card>
                <Card>
                  <h3>Creative Insights</h3>
                  {insights.length ? (
                    <ul className={styles.insightList}>
                      {insights.map((text, i) => (
                        <li key={i}>{text}</li>
                      ))}
                    </ul>
                  ) : (
                    <Empty title="Belum cukup data untuk insight">
                      Minimal 2 creative dengan delivery pada tiap format diperlukan sebelum
                      perbandingan ditampilkan.
                    </Empty>
                  )}
                </Card>
                <Card>
                  <h3>Creative Distribution</h3>
                  {distribution.length ? (
                    distribution.map((d) => (
                      <div className={styles.distRow} key={d.format}>
                        <span>{d.format}</span>
                        <div className={styles.distBar}>
                          <i style={{ width: `${(d.count / maxDistribution) * 100}%` }} />
                        </div>
                        <b>{d.count}</b>
                      </div>
                    ))
                  ) : (
                    <p className={styles.muted}>Belum ada creative untuk didistribusikan.</p>
                  )}
                </Card>
              </>
            );
            // Portal into the page's one real right rail when it's mounted (the normal case), so
            // these sections render flush with Campaign Structure/Controls/Automation instead of a
            // second, narrower nested column. Falls back to a local aside — same visual family,
            // just not portaled — when there's no slot yet (e.g. CampaignTabs under test in
            // isolation).
            return creativeRailSlot ? (
              createPortal(railContent, creativeRailSlot)
            ) : (
              <aside className={styles.creativeRail}>{railContent}</aside>
            );
          })()}
        </>
      )}
      {tab === "leads" && (
        <>
          <div className={styles.heroRow} data-testid="lead-quality-hero">
            <div className={styles.heroLeft}>
              <span className={styles.heroAvatar} aria-hidden="true">
                ✧
              </span>
              <div className={styles.heroLeftBody}>
                <div className={styles.heroTitleRow}>
                  <b>Samantha&apos;s Lead Quality Analysis</b>
                  <span className={styles.heroPosture} data-posture={leadAnalysis.posture}>
                    {presentLabel(leadAnalysis.posture)}
                  </span>
                  <small>Diperbarui {formatRelativeTimeId(item.campaign.syncedAt)}</small>
                </div>
                <p>{leadAnalysis.summary}</p>
                <p>{leadAnalysis.recommendation}</p>
                <p className={styles.muted}>{leadAnalysis.trackingCaveat}</p>
              </div>
            </div>
            <div className={styles.heroRight}>
              <div className={styles.heroRightHead}>
                <b>◆ Key Insight</b>
                <button
                  disabled={!leads?.length}
                  title={!leads?.length ? "Belum ada lead teratribusi" : undefined}
                  onClick={() => setShowLeadFullAnalysis(true)}
                >
                  View Full Analysis →
                </button>
              </div>
              {leadAnalysis.keyInsights.length ? (
                <ul className={styles.insightList}>
                  {leadAnalysis.keyInsights.map((text, i) => (
                    <li key={i}>{text}</li>
                  ))}
                </ul>
              ) : (
                <p className={styles.muted}>
                  Belum cukup data untuk insight. Minimal {MIN_LEAD_SAMPLE} lead teratribusi
                  diperlukan.
                </p>
              )}
            </div>
          </div>
          <Stats
            values={[
              ["Meta CPL · selected period", money(item.cpl)],
              ["CPQL", "—"],
              ["CRM attributed · all time", leads?.length ?? "—"],
              ["Qualified HOT", qualified ?? "—"],
            ]}
          />
          <div className={styles.twoCol}>
            {funnel}
            <Card>
              <h3>Lead problems & opportunities</h3>
              {leads ? (
                <>
                  <p>
                    {leads.filter((l) => !l.contacted).length} lead teratribusi belum memiliki
                    percakapan.
                  </p>
                  <p>
                    {
                      leads.filter(
                        (l) =>
                          l.temperature === "HOT" &&
                          l.status !== "ASSIGNED" &&
                          l.status !== "CLOSED",
                      ).length
                    }{" "}
                    HOT lead belum assigned atau closed.
                  </p>
                  <p className={styles.muted}>
                    CPQL belum dihitung karena periode spend dan cohort CRM belum selaras.
                    Appointment, survey, dan booking memerlukan event CRM khusus.
                  </p>
                </>
              ) : (
                <p>Data Clara belum tersedia.</p>
              )}
            </Card>
          </div>
          <Card>
            <h3>Quality trend</h3>
            <p className={styles.muted}>
              Raw Leads per tanggal dibuat; Qualified per tanggal becameHotAt (bukan perubahan skor
              historis). Kedua series dari lead teratribusi campaign ini.
            </p>
            {leads ? (
              <div className={styles.twoCol}>
                <Plot
                  title="Raw Leads per hari"
                  labels={leadTrend.days}
                  values={leadTrend.rawByDay}
                />
                <Plot
                  title="Qualified lead events per hari"
                  labels={leadTrend.days}
                  values={leadTrend.qualifiedByDay}
                />
              </div>
            ) : (
              <p>Memuat data kualitas…</p>
            )}
            {leads &&
              (() => {
                const rateDays = leadTrend.days.filter(
                  (d, i) => leadTrend.hotRateByDay[i] !== undefined,
                );
                const rateValues = leadTrend.hotRateByDay.filter(
                  (v): v is number => v !== undefined,
                );
                return rateDays.length >= 2 ? (
                  <Plot title="Hot Lead Rate per hari (%)" labels={rateDays} values={rateValues} />
                ) : (
                  <p className={styles.muted}>
                    Hot Lead Rate per hari memerlukan minimal 2 hari dengan Raw Leads {">"} 0.
                  </p>
                );
              })()}
          </Card>
          <Card>
            <h3>Lead Quality by Creative</h3>
            <p className={styles.observation}>
              <b>Atribusi lead-ke-creative belum tersedia.</b> Lead di codebase ini hanya bisa
              dihubungkan ke campaign, bukan ke ad/creative tertentu — kolom Raw Leads, Hot Leads,
              Hot Lead Rate, CPQL, Appointment, dan Booking di bawah adalah honest gap (
              &ldquo;—&rdquo;), bukan nol. Kolom Creative/Health/Format/Spend/CTR/CPL tetap real
              dari data Meta per ad.
            </p>
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    {[
                      "Creative",
                      "Health",
                      "Format",
                      "Spend",
                      "CTR",
                      "CPL",
                      "Raw Leads",
                      "Hot Leads",
                      "Hot Lead Rate",
                      "CPQL",
                      "Appointment",
                      "Booking",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gallery.map((g) => (
                    <tr key={g.ad.metaId}>
                      <td>
                        {g.ad.stableId} · {g.ad.headline || g.ad.name}
                      </td>
                      <td>
                        <span className={styles.tag} data-health={g.status}>
                          {g.status}
                        </span>
                      </td>
                      <td>{g.format}</td>
                      <td>{money(g.spend)}</td>
                      <td>{g.ctr !== undefined ? `${(g.ctr * 100).toFixed(2)}%` : "—"}</td>
                      <td>{money(g.cpl)}</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!gallery.length && (
              <Empty title="Belum ada creative pada campaign ini">
                Tabel lead quality per creative akan tampil setelah ada ad pada campaign ini.
              </Empty>
            )}
          </Card>
          <Card>
            <div className={styles.sectionHead}>
              <h3>Attributed lead status</h3>
              <div className={styles.controls}>
                <select
                  aria-label="Filter status lead"
                  value={leadStatusFilter}
                  onChange={(e) => setLeadStatusFilter(e.target.value)}
                >
                  <option value="All">All Status</option>
                  {leadStatusOptions.map((s) => (
                    <option key={s} value={s}>
                      {presentLabel(s)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter temperature lead"
                  value={leadTempFilter}
                  onChange={(e) => setLeadTempFilter(e.target.value)}
                >
                  <option value="All">All Temperature</option>
                  {leadTempOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Lead reference</th>
                    <th>Status</th>
                    <th>Temperature</th>
                    <th>Score</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLeads.slice(0, 50).map((l) => (
                    <tr key={l.id}>
                      <td>{l.id.slice(0, 8)}</td>
                      <td>{presentLabel(l.status)}</td>
                      <td>{l.temperature}</td>
                      <td>{l.score}</td>
                      <td>{date(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {leads && !visibleLeads.length && (
              <Empty title="Tidak ada lead sesuai filter">
                Ubah filter status atau temperature untuk melihat lead campaign ini.
              </Empty>
            )}
          </Card>
          {(() => {
            const railContent = (
              <>
                <Card>
                  <h3>Respon Pintar Integration</h3>
                  <p>
                    <b>Respon Pintar belum terhubung.</b>
                  </p>
                  <p className={styles.muted}>
                    Menghubungkan Respon Pintar akan membuka pengukuran Hot Leads yang tervalidasi
                    sales, CPQL, Appointment, dan Booking untuk campaign ini. Analitik Meta di atas
                    tetap ditampilkan tanpa memerlukan integrasi ini.
                  </p>
                  <button
                    disabled
                    title="Konfigurasi integrasi Respon Pintar belum tersedia di aplikasi ini."
                  >
                    Configure Integration
                  </button>
                </Card>
                <Card>
                  <h3>First Message Intelligence</h3>
                  <Empty title="Belum tersedia">
                    Belum ada capture atau klasifikasi pesan pertama pada data lead codebase ini —
                    distribusi intent (mis. Harga/KPR/Lokasi) tidak bisa ditampilkan.
                  </Empty>
                </Card>
                <Card>
                  <h3>Lead Quality Insights</h3>
                  {leadInsights.length ? (
                    <ul className={styles.insightList}>
                      {leadInsights.map((text, i) => (
                        <li key={i}>{text}</li>
                      ))}
                    </ul>
                  ) : (
                    <Empty title="Belum cukup data untuk insight">
                      Minimal {MIN_LEAD_SAMPLE} lead teratribusi diperlukan sebelum insight
                      ditampilkan.
                    </Empty>
                  )}
                </Card>
              </>
            );
            // Same portal-into-page-rail pattern as the Creative Health tab's rail sections — reuses
            // the one real right rail slot rather than a second nested column.
            return creativeRailSlot ? (
              createPortal(railContent, creativeRailSlot)
            ) : (
              <aside className={styles.creativeRail}>{railContent}</aside>
            );
          })()}
        </>
      )}
      {tab === "budget" && (
        <>
          <div className={styles.heroRow} data-testid="budget-decision-hero">
            <div className={styles.heroLeft}>
              <span className={styles.heroAvatar} aria-hidden="true">
                ✧
              </span>
              <div className={styles.heroLeftBody}>
                <div className={styles.heroTitleRow}>
                  <b>Samantha&apos;s Budget Decision</b>
                  <span className={styles.heroPosture} data-posture={budgetDecision.posture}>
                    {budgetDecision.decisionLabel}
                  </span>
                  <small>Diperbarui {formatRelativeTimeId(item.campaign.syncedAt)}</small>
                </div>
                <p>{budgetDecision.postureTitle}</p>
                <p>{budgetDecision.reason}</p>
                <p className={styles.muted}>{budgetDecision.recommendationNote}</p>
              </div>
            </div>
            <div className={styles.heroRight}>
              <div className={styles.heroRightHead}>
                <b>◆ Current vs Recommended</b>
              </div>
              <Stats
                values={[
                  ["Current daily budget", money(budgetDecision.currentBudget)],
                  [
                    "Confidence",
                    budgetDecision.confidencePct === undefined
                      ? "—"
                      : `${budgetDecision.confidencePct}%`,
                  ],
                  ["Review after", `${budgetDecision.reviewAfterHours ?? "—"} jam`],
                  ["Allowed change now", "Belum terhubung"],
                ]}
              />
              <p className={styles.muted}>{budgetDecision.allowedChangeNow}</p>
            </div>
          </div>
          <Card>
            <h3>Rollback if</h3>
            {budgetDecision.rollbackConditions.length ? (
              budgetDecision.rollbackConditions.map((c, i) => <p key={i}>{presentText(c)}</p>)
            ) : (
              <p className={styles.muted}>Belum ada kondisi rollback yang ditetapkan.</p>
            )}
          </Card>
          <Stats
            values={[
              ["Actual · selected period", money(item.campaign.spend)],
              ["Configured daily budget", money(item.budget)],
              ["Observed daily average", money(average)],
              ["Next 7 days · estimate", money(average === undefined ? undefined : average * 7)],
            ]}
          />
          <p className={styles.muted}>
            Forecast memakai rata-rata maksimal 7 snapshot terakhir × 7; bukan janji hasil. Expected
            pacing memakai budget saat ini, bukan riwayat perubahan budget.
          </p>
          <div className={styles.twoCol}>
            <Card>
              <h3>Budget Pacing</h3>
              {budgetPacing.hasData ? (
                <>
                  <Stats
                    values={[
                      ["Target · window", money(budgetPacing.periodTarget)],
                      ["Actual · window", money(budgetPacing.actualSpend)],
                      [
                        "Pacing",
                        budgetPacing.pacingPct === undefined
                          ? "—"
                          : `${budgetPacing.pacingPct.toFixed(0)}%`,
                      ],
                      ["Projected · next 7 days", money(budgetPacing.projectedSpend)],
                    ]}
                  />
                  <p>
                    Status: <b>{budgetPacing.status}</b>
                  </p>
                </>
              ) : (
                <Empty title="Belum cukup data untuk pacing">
                  Pacing memerlukan budget harian dan minimal 1 hari riwayat spend nyata.
                </Empty>
              )}
              <p className={styles.muted}>{budgetPacing.caveat}</p>
            </Card>
            <Card>
              <h3>Actual vs expected</h3>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Actual</th>
                      <th>Expected / day</th>
                      <th>Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastSeven.map((p) => (
                      <tr key={p.date}>
                        <td>{p.date}</td>
                        <td>{money(p.spend)}</td>
                        <td>{money(item.budget)}</td>
                        <td>
                          {item.budget ? `${((p.spend / item.budget - 1) * 100).toFixed(0)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card>
              <h3>Budget Trend · daily spend</h3>
              <Plot
                title="Daily spend"
                labels={(history ?? []).map((p) => p.date)}
                values={(history ?? []).map((p) => p.spend)}
                monetary
              />
            </Card>
            <Card>
              <h3>Budget Trend · CPL</h3>
              <Plot
                title="Daily CPL"
                labels={(history ?? []).map((p) => p.date)}
                values={(history ?? []).map((p) => p.cpl)}
                monetary
              />
              <p className={styles.muted}>
                CPQL belum bisa ditampilkan — tidak ada data CRM/attribution per hari di codebase
                ini.
              </p>
            </Card>
            <Card>
              <h3>Efficiency & Headroom</h3>
              <p>CPQL vs baseline: —</p>
              <p>
                Hot Lead Rate:{" "}
                {budgetHotLeadRate === undefined ? "—" : `${(budgetHotLeadRate * 100).toFixed(0)}%`}
              </p>
              <p>Scale Headroom: —</p>
              <p>Creative Capacity: —</p>
              <p className={styles.muted}>
                {budgetHotLeadRate === undefined
                  ? `Hot Lead Rate memerlukan minimal ${MIN_LEAD_SAMPLE} lead teratribusi.`
                  : "Hot Lead Rate dari seluruh lead teratribusi campaign ini (sepanjang waktu)."}{" "}
                CPQL, Scale Headroom, dan Creative Capacity memerlukan data attribution/baseline
                budget yang belum tersedia di codebase ini.
              </p>
            </Card>
            <Card>
              <h3>Potential Waste</h3>
              {potentialWaste.fatiguedSpend !== undefined ? (
                <p>
                  <b>{money(potentialWaste.fatiguedSpend)}</b> potential waste pada{" "}
                  {potentialWaste.fatiguedCount} creative berstatus Fatigued (real spend Meta pada
                  creative tersebut).
                </p>
              ) : (
                <p className={styles.muted}>Tidak ada creative Fatigued saat ini.</p>
              )}
              <p className={styles.muted}>
                Kategori lain (spend pada lead kualitas rendah, spend tanpa hasil, spend terbatas
                tracking) belum bisa dihitung — tidak ada sumber data real untuk kategori tersebut
                di codebase ini. Angka di atas adalah &ldquo;potential&rdquo;, bukan kerugian pasti.
              </p>
            </Card>
            <Card>
              <h3>Scaling headroom</h3>
              <p>
                {item.assessment?.decision.decision === "SCALE"
                  ? "Samantha mengidentifikasi kandidat scaling."
                  : "Belum ada rekomendasi scaling yang disetujui."}
              </p>
              <p>Headroom terverifikasi: —</p>
              <p className={styles.muted}>
                Diperlukan batas budget akun dan baseline biaya yang tervalidasi sebelum nominal
                tambahan bisa dihitung.
              </p>
            </Card>
            <Card>
              <h3>Rollback & monitoring</h3>
              <p>
                Review: {item.assessment?.decision.monitoringPlan.reviewAfterHours ?? "—"} jam
                setelah tindakan.
              </p>
              {item.assessment?.decision.monitoringPlan.rollbackConditions.map((c, i) => (
                <p key={i}>{presentText(c)}</p>
              ))}
            </Card>
          </div>
          <Card>
            <h3>Campaign Recommendation</h3>
            <Stats
              values={[
                ["Suggested action", budgetDecision.decisionLabel],
                ["Impact estimate", "Impact estimate unavailable"],
                ["Risk", "—"],
                ["Next review", `${budgetDecision.reviewAfterHours ?? "—"} jam`],
              ]}
            />
            <p className={styles.muted}>{budgetDecision.reviewNote}</p>
            <p className={styles.muted}>
              Risk belum bisa dihitung — tidak ada field impact/risk numerik yang real pada decision
              ini selain kategori impact kualitatif yang sudah dipakai untuk menentukan review
              window.
            </p>
            <button
              disabled
              title="Belum ada endpoint eksekusi/policy approval yang terhubung ke Meta untuk perubahan budget ini."
            >
              Apply Budget Change
            </button>
          </Card>
          <Card>
            <h3>Budget Action History</h3>
            <Timeline activities={budgetEvents} />
          </Card>
          {(() => {
            const railContent = (
              <>
                <Card>
                  <h3>Budget Guardrails</h3>
                  <Empty title="Belum terhubung">
                    Tidak ada konfigurasi guardrail budget per tenant (batas kenaikan/penurunan
                    maksimal, budget minimum/maksimum harian) di codebase ini.
                  </Empty>
                </Card>
                <Card>
                  <h3>Budget Insights</h3>
                  {budgetInsightList.length ? (
                    <ul className={styles.insightList}>
                      {budgetInsightList.map((text, i) => (
                        <li key={i}>{text}</li>
                      ))}
                    </ul>
                  ) : (
                    <Empty title="Belum cukup data untuk insight">
                      Insight budget memerlukan minimal 1 hari riwayat spend nyata dan/atau
                      assessment Samantha yang tersedia.
                    </Empty>
                  )}
                </Card>
              </>
            );
            // Same portal-into-page-rail pattern the Creative Health/Lead Quality tabs already
            // establish — reuses the one real right rail slot rather than a second nested column.
            return creativeRailSlot ? (
              createPortal(railContent, creativeRailSlot)
            ) : (
              <aside className={styles.creativeRail}>{railContent}</aside>
            );
          })()}
        </>
      )}
      {tab === "experiments" && (
        <>
          {!data?.tests ? (
            <Card>
              <p>Data eksperimen belum tersedia.</p>
            </Card>
          ) : (
            <>
              <div className={styles.heroRow} data-testid="experiments-hero">
                <div className={styles.heroLeft}>
                  <span className={styles.heroAvatar} aria-hidden="true">
                    ✧
                  </span>
                  <div className={styles.heroLeftBody}>
                    <div className={styles.heroTitleRow}>
                      <b>Samantha&apos;s Experiment Recommendation</b>
                      <span className={styles.tag}>{experimentOverview.total} eksperimen</span>
                      <small>Diperbarui {formatRelativeTimeId(item.campaign.syncedAt)}</small>
                    </div>
                    <p>{experimentRecommendation.summary}</p>
                  </div>
                </div>
                <div className={styles.heroRight}>
                  <div className={styles.heroRightHead}>
                    <b>◆ Key Insight</b>
                    <button
                      disabled
                      title="Pembuatan eksperimen belum tersedia di aplikasi ini — belum ada flow Experiment Builder yang terhubung."
                    >
                      ＋ Buat Eksperimen Baru
                    </button>
                  </div>
                  {experimentRecommendation.keyInsights.length ? (
                    <ul className={styles.insightList}>
                      {experimentRecommendation.keyInsights.map((text, i) => (
                        <li key={i}>{text}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.muted}>
                      Belum cukup data untuk insight eksperimen pada campaign ini.
                    </p>
                  )}
                </div>
              </div>
              <Card>
                <h3>Experiment Overview</h3>
                <div className={styles.healthCounts}>
                  {(
                    [
                      ["Total", experimentOverview.total],
                      ["Running", experimentOverview.running],
                      ["Winner", experimentOverview.winner],
                      ["Inconclusive", experimentOverview.inconclusive],
                      ["Stopped", experimentOverview.stopped],
                      ["Draft", experimentOverview.draft],
                    ] as [string, number][]
                  ).map(([label, count]) => (
                    <div key={label}>
                      <b>{count}</b>
                      <small>{label}</small>
                    </div>
                  ))}
                </div>
                <p className={styles.muted}>
                  Stopped = status real PAUSED atau FAILED. Winner = status COMPLETE dengan
                  winnerVariantId real. Inconclusive = status COMPLETE tanpa winnerVariantId (margin
                  belum cukup atau data belum sebanding).
                </p>
              </Card>
              <div className={styles.twoCol}>
                <Card>
                  <h3>Hasil Eksperimen</h3>
                  <Stats
                    values={[
                      [
                        "Rata-rata improvement winner",
                        experimentResults.averageImprovementPct !== undefined
                          ? `${experimentResults.averageImprovementPct}% Rp/lead`
                          : "—",
                      ],
                      ["Eksperimen dengan winner", experimentResults.count || "—"],
                      ["Hot Lead Rate", "—"],
                      ["CPQL", "—"],
                      ["Qualified Leads", "—"],
                      ["Booking Rate", "—"],
                    ]}
                  />
                  <p className={styles.muted}>
                    Primary metric real yang dievaluasi backend adalah {RPH_LEAD_LABEL}. Hot Lead
                    Rate, CPQL, Qualified Leads, dan Booking Rate memerlukan data CRM/tahapan lead
                    per eksperimen yang belum tersedia di codebase ini.
                  </p>
                </Card>
                <Card>
                  <h3>Learning &amp; Insights</h3>
                  {experimentLearningList.length ? (
                    <ul className={styles.insightList}>
                      {experimentLearningList.map((text, i) => (
                        <li key={i}>{text}</li>
                      ))}
                    </ul>
                  ) : (
                    <Empty title="Belum ada learning">
                      Learning muncul setelah minimal satu eksperimen COMPLETE dengan winner real
                      pada campaign ini.
                    </Empty>
                  )}
                </Card>
              </div>
              <Card>
                <h3>Mulai Eksperimen Baru</h3>
                <p className={styles.muted}>
                  Template berikut bersifat deskriptif — pembuatan eksperimen dari template belum
                  terhubung ke endpoint apapun di putaran ini.
                </p>
                <div className={styles.templateGrid}>
                  {EXPERIMENT_TEMPLATES.map((tpl) => (
                    <article className={styles.templateCard} key={tpl.key}>
                      <h3>{tpl.title}</h3>
                      <p>{tpl.description}</p>
                      <button
                        disabled
                        title="Pembuatan eksperimen dari template belum tersedia di aplikasi ini."
                      >
                        Pilih Template
                      </button>
                    </article>
                  ))}
                </div>
              </Card>
              <Card>
                <div className={styles.sectionHead}>
                  <h3>Daftar Eksperimen</h3>
                  <span>
                    {visibleExperiments.length} dari {experimentSourceList.length}
                  </span>
                </div>
                <div className={styles.toolbar}>
                  <input
                    type="search"
                    aria-label="Cari eksperimen"
                    placeholder="Cari nama, ID, atau angle…"
                    value={experimentSearch}
                    onChange={(e) => setExperimentSearch(e.target.value)}
                  />
                  <select
                    aria-label="Filter status eksperimen"
                    value={experimentStatusFilter}
                    onChange={(e) =>
                      setExperimentStatusFilter(e.target.value as ExperimentStatusFilter)
                    }
                  >
                    <option value="All">All Status</option>
                    {["Running", "Winner selected", "Inconclusive", "Stopped", "Draft"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Urutkan eksperimen"
                    value={experimentSortKey}
                    onChange={(e) => setExperimentSortKey(e.target.value as ExperimentSortKey)}
                  >
                    <option value="progress">Sort by: Progress</option>
                    <option value="createdAt">Sort by: Terbaru</option>
                    <option value="improvementPct">Sort by: Improvement</option>
                  </select>
                  <button
                    aria-pressed={showArchivedExperiments}
                    onClick={() => setShowArchivedExperiments((v) => !v)}
                    title="Tidak ada penyimpanan arsip terpisah — ini memfilter ke eksperimen COMPLETE/PAUSED/FAILED."
                  >
                    {showArchivedExperiments ? "← Semua Eksperimen" : "Lihat Arsip"}
                  </button>
                </div>
                {visibleExperiments.length ? (
                  <div className={styles.tableWrap}>
                    <table>
                      <thead>
                        <tr>
                          {[
                            "Eksperimen",
                            "Hipotesis",
                            "Varian",
                            "Primary Metric",
                            "Progress",
                            "Status",
                            "Hasil",
                            "",
                          ].map((h) => (
                            <th key={h}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleExperiments.map((t) => {
                          const winner = winningVariant(t);
                          const status = presentExperimentStatus(t);
                          return (
                            <tr key={t.id}>
                              <td>{t.name}</td>
                              <td>
                                {t.variants.map((v) => presentLabel(v.angle)).join(" vs ") ||
                                  "Belum dicatat"}
                              </td>
                              <td>
                                <VariantThumbPair test={t} />
                              </td>
                              <td>
                                {winner && variantRphLead(winner) !== undefined
                                  ? money(variantRphLead(winner))
                                  : "—"}
                              </td>
                              <td>
                                <progress max="100" value={experimentProgress(t)} />{" "}
                                {experimentProgress(t)}%
                              </td>
                              <td>
                                <span className={styles.tag}>{status}</span>
                              </td>
                              <td>{experimentResultLabel(t)}</td>
                              <td>
                                <button onClick={() => setExperimentDetailId(t.id)}>
                                  Lihat Detail
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : tests.length ? (
                  <Empty title="Tidak ada eksperimen sesuai filter">
                    Ubah pencarian, status, atau tampilan arsip untuk melihat eksperimen campaign
                    ini.
                  </Empty>
                ) : (
                  <Empty title="Belum ada eksperimen untuk campaign ini">
                    Control, variants, progress, dan hasil akan tampil saat eksperimen terhubung ke
                    campaign ini.
                  </Empty>
                )}
              </Card>
              {(() => {
                const railContent = (
                  <Card>
                    <h3>Integrasi Terkait</h3>
                    <div className={styles.linkCard}>
                      <div>
                        <b>Creative Health</b>
                        <p>Lihat angle dan format creative yang tersedia untuk dijadikan varian.</p>
                      </div>
                      <button onClick={() => onTab("creative")}>Buka →</button>
                    </div>
                    <div className={styles.linkCard}>
                      <div>
                        <b>Kai Studio</b>
                        <p>Produksi creative baru untuk varian eksperimen berikutnya.</p>
                      </div>
                      <Link href="/kai-studio">Buka →</Link>
                    </div>
                    <div className={styles.linkCard}>
                      <div>
                        <b>Learning Phase Guardian</b>
                        <p>Status learning phase real ditampilkan di atas tab campaign ini.</p>
                      </div>
                      <Link href="/automation">Buka →</Link>
                    </div>
                    <div className={styles.linkCard}>
                      <div>
                        <b>Budget</b>
                        <p>Pacing dan budget harian campaign ini.</p>
                      </div>
                      <button onClick={() => onTab("budget")}>Buka →</button>
                    </div>
                  </Card>
                );
                // Same portal-into-page-rail pattern the Creative Health/Lead Quality/Budget tabs
                // already establish — reuses the one real right rail slot rather than a second
                // nested column.
                return creativeRailSlot ? (
                  createPortal(railContent, creativeRailSlot)
                ) : (
                  <aside className={styles.creativeRail}>{railContent}</aside>
                );
              })()}
            </>
          )}
          <Drawer
            open={!!experimentDetail}
            onClose={() => setExperimentDetailId(undefined)}
            title="Detail eksperimen"
          >
            {experimentDetail && (
              <>
                <div className={styles.sectionHead}>
                  <h3>{experimentDetail.name}</h3>
                  <span className={styles.tag}>{presentExperimentStatus(experimentDetail)}</span>
                </div>
                <p>
                  Hipotesis:{" "}
                  {experimentDetail.variants.map((v) => presentLabel(v.angle)).join(" vs ") ||
                    "Belum dicatat"}
                </p>
                <Stats
                  values={[
                    ["Minimum spend / variant", money(experimentDetail.thresholdSpend)],
                    ["Minimum duration", `${experimentDetail.thresholdDays} hari`],
                    ["Minimum margin", `${experimentDetail.minMarginPct}%`],
                    ["Eligibility progress", `${experimentProgress(experimentDetail)}%`],
                  ]}
                />
                <progress max="100" value={experimentProgress(experimentDetail)} />
                <p className={styles.muted}>
                  Hasil: {experimentResultLabel(experimentDetail)}
                  {experimentDetail.status === "COMPLETE" && !experimentDetail.winnerVariantId
                    ? " — margin real belum cukup atau data antar varian belum sebanding untuk menentukan winner."
                    : ""}
                </p>
                <h3>Varian</h3>
                <div className={styles.gallery}>
                  {experimentDetail.variants.map((v, i) => (
                    <article className={styles.creative} key={v.id}>
                      <Media image={v.imageUrl} video={v.videoUrl} name={v.variantLabel} />
                      <div>
                        <span className={styles.tag}>
                          {v.id === experimentDetail.winnerVariantId
                            ? "Winner"
                            : presentLabel(v.status)}
                        </span>
                        <h3>
                          {v.variantLabel} · {presentLabel(v.angle)}
                        </h3>
                        <small>
                          {i === 0
                            ? "Reference variant (control not explicitly designated)"
                            : "Comparison variant"}
                        </small>
                        {(v.primaryText || v.headline) && (
                          <p className={styles.muted}>
                            {v.headline && <b>{v.headline}</b>}
                            {v.headline && v.primaryText ? " — " : ""}
                            {v.primaryText}
                          </p>
                        )}
                        <Stats
                          values={[
                            ["Spend", money(v.spend)],
                            ["Leads", v.leads],
                            ["Rp/lead", money(variantRphLead(v))],
                            ["CTR", v.ctr !== undefined ? `${(v.ctr * 100).toFixed(2)}%` : "—"],
                          ]}
                        />
                      </div>
                    </article>
                  ))}
                </div>
                {item.assessment?.decision.monitoringPlan && (
                  <>
                    <h3>Monitoring plan campaign</h3>
                    <p className={styles.muted}>
                      Review: {item.assessment.decision.monitoringPlan.reviewAfterHours ?? "—"} jam
                      setelah keputusan campaign terakhir. Ini adalah monitoring plan tingkat
                      campaign, bukan khusus eksperimen ini.
                    </p>
                  </>
                )}
              </>
            )}
          </Drawer>
        </>
      )}
      {tab === "history" && (
        <Card>
          <h3>Agent timeline</h3>
          <Timeline activities={activities} />
        </Card>
      )}
      {tab === "kai" && (
        <>
          <div className={styles.sectionHead}>
            <div>
              <h3>Kai Creative production</h3>
              <p>
                Paket terkait melalui ad, eksperimen, atau listing yang sama. Maksimal 200 paket
                terbaru.
              </p>
            </div>
            <button
              onClick={() => {
                setBrief(true);
                setNotice("");
              }}
            >
              ＋ New Kai brief
            </button>
          </div>
          <Stats
            values={[
              ["Draft", data?.packages ? packages.filter((p) => p.status === "DRAFT").length : "—"],
              [
                "Generating",
                data?.packages ? packages.filter((p) => p.status === "GENERATING").length : "—",
              ],
              [
                "QA pending",
                data?.packages ? packages.filter((p) => p.status === "PENDING").length : "—",
              ],
              [
                "Approved",
                data?.packages ? packages.filter((p) => p.status === "APPROVED").length : "—",
              ],
            ]}
          />
          {!data?.packages ? (
            <Empty title="Data Kai belum tersedia">
              Tunggu pembacaan data atau gunakan Retry workspace data.
            </Empty>
          ) : !packages.length ? (
            <Empty title="Belum ada paket Kai yang terkait">
              Kirim brief dari campaign ini setelah listing terhubung. Paket campaign lain tidak
              ditampilkan.
            </Empty>
          ) : (
            packages.map((p) => (
              <Card key={p.id}>
                <div className={styles.sectionHead}>
                  <h3>{p.title}</h3>
                  <span className={styles.tag}>{presentLabel(p.status)}</span>
                </div>
                <div className={styles.steps}>
                  {["DRAFT", "GENERATING", "PENDING", "APPROVED"].map((s, i) => (
                    <span key={s} data-active={p.status === s}>
                      {i + 1}. {s === "PENDING" ? "QA review" : presentLabel(s)}
                    </span>
                  ))}
                </div>
                <div className={styles.twoCol}>
                  <Media image={p.imageUrls?.[0]} video={p.videoUrl} name={p.title} />
                  <div>
                    <h3>Active brief · {presentLabel(p.angle)}</h3>
                    <p>{p.primaryMessage || p.reason}</p>
                    <p>
                      QA:{" "}
                      {p.reviewedAt
                        ? `Reviewed ${date(p.reviewedAt)}`
                        : p.status === "FAILED"
                          ? "Generation failed; no QA result"
                          : "Belum direview"}
                    </p>
                    <p>
                      Lineage: {p.briefId} → package {p.id.slice(0, 8)} →{" "}
                      {p.publishedMetaAdIds?.length ?? 0} published ads
                    </p>
                    <Link href={`/kai-studio?package=${encodeURIComponent(p.id)}`}>
                      Open Kai Studio →
                    </Link>{" "}
                    <button onClick={() => setVariant(p)}>Explore visual concepts & copy</button>
                    {p.status === "FAILED" && (
                      <p role="status">
                        Produksi gagal. Belum ada aset siap terbit dari proses ini.
                      </p>
                    )}
                    <h3>Published performance</h3>
                    {(() => {
                      const published = ads.filter((a) => p.publishedMetaAdIds?.includes(a.metaId));
                      return published.length ? (
                        <Stats
                          values={[
                            ["Spend", money(published.reduce((n, a) => n + a.metrics.spend, 0))],
                            ["Leads", published.reduce((n, a) => n + a.metrics.totalLead, 0)],
                          ]}
                        />
                      ) : (
                        <p className={styles.muted}>
                          Belum ada published ad terkait pada campaign ini.
                        </p>
                      );
                    })()}
                  </div>
                </div>
              </Card>
            ))
          )}
        </>
      )}
      <Drawer
        open={showFullAnalysis}
        onClose={() => setShowFullAnalysis(false)}
        title="Samantha · Full Creative Analysis"
      >
        <p>{analysis.summary}</p>
        <p>{analysis.recommendation}</p>
        <h3>Key insights</h3>
        {analysis.keyInsights.length ? (
          analysis.keyInsights.map((text, i) => <p key={i}>{text}</p>)
        ) : (
          <p className={styles.muted}>Belum cukup data untuk insight.</p>
        )}
        <h3>Evidence campaign-level</h3>
        {item.assessment?.diagnosis.evidence.length ? (
          item.assessment.diagnosis.evidence.map((signal, index) => (
            <section key={index}>
              <h3>{presentLabel(signal.type)}</h3>
              <p>
                {signal.metric}: {signal.baselineValue ?? "—"} → {signal.currentValue ?? "—"}
              </p>
              <p>{presentText(signal.reasoning)}</p>
            </section>
          ))
        ) : (
          <p className={styles.muted}>Belum ada evidence campaign-level untuk assessment ini.</p>
        )}
      </Drawer>
      <Drawer
        open={showLeadFullAnalysis}
        onClose={() => setShowLeadFullAnalysis(false)}
        title="Samantha · Full Lead Quality Analysis"
      >
        <p>{leadAnalysis.summary}</p>
        <p>{leadAnalysis.recommendation}</p>
        <p className={styles.muted}>{leadAnalysis.trackingCaveat}</p>
        <h3>Key insights</h3>
        {leadAnalysis.keyInsights.length ? (
          leadAnalysis.keyInsights.map((text, i) => <p key={i}>{text}</p>)
        ) : (
          <p className={styles.muted}>Belum cukup data untuk insight.</p>
        )}
      </Drawer>
      <Drawer
        open={brief}
        onClose={() => {
          if (!saving) setBrief(false);
        }}
        title="Send creative brief to Kai"
      >
        <p>
          Brief disimpan sebagai Draft untuk ditinjau. Generation dan publikasi dijalankan terpisah.
        </p>
        <div className={styles.form}>
          <label>
            Angle
            <select value={angle} onChange={(e) => setAngle(e.target.value)}>
              {[
                "INVESTASI",
                "DP_RINGAN",
                "READY_HUNI",
                "EXCLUSIVE",
                "SYARIAH",
                "PROMO_TERBATAS",
                "TESTIMONIAL",
                "VIRTUAL_TOUR",
              ].map((a) => (
                <option key={a} value={a}>
                  {presentLabel(a)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Format
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="IMAGES_ONLY">Images</option>
              <option value="VIDEO_AND_IMAGES">Video + images</option>
            </select>
          </label>
          <label>
            Creative brief
            <textarea
              value={message}
              maxLength={2000}
              rows={5}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <button
            disabled={saving || !message.trim() || notice.startsWith("Brief tersimpan")}
            onClick={sendBrief}
          >
            {saving ? "Saving…" : "Save brief to Kai"}
          </button>
          {notice && <p role="status">{notice}</p>}
          {!data?.listingId && (
            <p>
              Campaign belum memiliki listing terhubung. Hubungkan listing sebelum mengirim brief.
            </p>
          )}
        </div>
      </Drawer>
      <Drawer
        open={!!variant}
        onClose={() => setVariant(undefined)}
        title="Creative concepts & variants"
      >
        {variant && (
          <>
            <h3>{variant.title}</h3>
            <div className={styles.gallery}>
              {variant.imageUrls?.map((url, i) => (
                <Media key={url} image={url} name={`Concept ${i + 1}`} />
              ))}
            </div>
            {variant.videoUrl && <Media video={variant.videoUrl} name={variant.title} />}
            <h3>Copy variants</h3>
            {variant.copyVariants?.length ? (
              variant.copyVariants.map((v) => (
                <article className={styles.empty} key={v.id}>
                  <b>
                    {v.variantLabel} · {v.headline}
                  </b>
                  <p>{v.primaryText}</p>
                </article>
              ))
            ) : (
              <p>Belum ada copy variants.</p>
            )}
          </>
        )}
      </Drawer>
      <Drawer open={!!detailItem} onClose={() => setDetailId(undefined)} title="Creative detail">
        {detailItem && (
          <>
            <Media image={detailItem.image} video={detailItem.video} name={detailItem.ad.name} />
            <div className={styles.badgeRow}>
              <span className={styles.tag} data-health={detailItem.status}>
                {detailItem.status}
              </span>
              <span className={styles.metaStatus} data-status={detailItem.ad.status}>
                {presentLabel(detailItem.ad.status)}
              </span>
            </div>
            <h3>
              {detailItem.ad.stableId} · {detailItem.ad.headline || detailItem.ad.name}
            </h3>
            <p className={styles.muted}>
              Ad ID: {detailItem.ad.metaId} · {detailItem.format} ·{" "}
              {detailItem.angle ? presentLabel(detailItem.angle) : "Angle belum tercatat"}
            </p>
            <Stats
              values={[
                [
                  "CTR",
                  detailItem.ctr !== undefined ? `${(detailItem.ctr * 100).toFixed(2)}%` : "—",
                ],
                ["CPL", money(detailItem.cpl)],
                ["Frequency", detailItem.frequency?.toFixed(2) ?? "—"],
                ["Leads", detailItem.leads],
                ["Spend", money(detailItem.spend)],
                ["CPQL", "—"],
              ]}
            />
            <h3>Performance trend</h3>
            {history ? (
              <>
                <Plot
                  values={(history ?? []).slice(-range).map((p) => p.spend)}
                  labels={(history ?? []).slice(-range).map((p) => p.date)}
                  title="Campaign spend trend"
                  monetary
                />
                <p className={styles.muted}>
                  Time series per creative belum tersedia; grafik di atas adalah trend campaign
                  (agregat semua creative), bukan trend creative ini secara khusus.
                </p>
              </>
            ) : (
              <p className={styles.muted}>Memuat riwayat campaign…</p>
            )}
            <h3>Lineage &amp; QA</h3>
            {detailItem.pkg ? (
              <>
                <p>
                  Lineage: {detailItem.pkg.briefId} → package {detailItem.pkg.id.slice(0, 8)} →{" "}
                  {detailItem.pkg.publishedMetaAdIds?.length ?? 0} published ads
                </p>
                <p>
                  QA:{" "}
                  {detailItem.pkg.reviewedAt
                    ? `Reviewed ${date(detailItem.pkg.reviewedAt)}`
                    : detailItem.pkg.status === "FAILED"
                      ? "Generation failed; no QA result"
                      : "Belum direview"}
                </p>
              </>
            ) : (
              <p className={styles.muted}>
                Creative ini belum tertaut ke paket Kai — lineage dan QA belum tersedia.
              </p>
            )}
            <h3>Lead quality &amp; first message</h3>
            <p className={styles.muted}>
              CPQL, hot lead rate per creative, dan first-message intelligence belum tersedia — lead
              saat ini hanya bisa dihubungkan ke campaign, bukan ke creative tertentu, dan belum ada
              field intent pesan pertama pada data lead.
            </p>
          </>
        )}
      </Drawer>
    </div>
  );
}
