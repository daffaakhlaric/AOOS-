"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/common/Card";
import { Drawer } from "@/components/common/Drawer";
import { LoadingState } from "@/components/common/LoadingState";
import { useAccountSummary } from "@/components/command-center/useAccountSummary";
import { useCampaignThumbnail } from "@/components/command-center/useCampaignThumbnail";
import { formatIdrCompact } from "@/lib/formatters";
import { presentLabel, presentText, getMetricDeltaIntent } from "@/lib/presentation";
import {
  mapCampaignPortfolioItem,
  type CampaignView,
  type PortfolioResponse,
  type HistoryPoint,
} from "@/lib/campaigns";
import styles from "./CampaignWorkspace.module.css";
import { CampaignTabs } from "./CampaignTabs";

const money = (n: number | undefined) => (n === undefined ? "—" : formatIdrCompact(n));
const tabs = [
  "Overview",
  "Performance",
  "Creative Health",
  "Lead Quality",
  "Budget",
  "Experiments",
  "History",
  "Kai Creative",
];
const tabKeys = [
  "overview",
  "performance",
  "creative",
  "leads",
  "budget",
  "experiments",
  "history",
  "kai",
];
function Badge({ text, tone = "UNKNOWN" }: { text: string; tone?: string }) {
  return <span className={`${styles.badge} ${styles[tone] ?? ""}`}>{text}</span>;
}
function Photo({ item }: { item: CampaignView }) {
  const fallback = useCampaignThumbnail(item.campaign.metaId);
  const [failed, setFailed] = useState(false);
  const creative = item.assessment?.representativeCreative;
  const url = !failed && creative?.thumbnailUrl ? creative.thumbnailUrl : fallback.url;
  return (
    <span className={styles.photo}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- real Meta or listing media
        <img
          src={url}
          alt={item.name}
          onError={() => {
            if (!failed && creative?.thumbnailUrl) setFailed(true);
            else fallback.onImageError();
          }}
        />
      ) : (
        <span title="Preview belum tersedia" aria-label="Preview belum tersedia">
          ▧
        </span>
      )}
      {creative?.kind === "VIDEO" && <small>▶</small>}
    </span>
  );
}
function metric(value: number | undefined, key?: string) {
  if (value === undefined) return "—";
  return key === "ctr"
    ? `${(value * 100).toFixed(2)}%`
    : key === "cpl"
      ? money(value)
      : value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

export function CampaignWorkspace({ campaignId }: { campaignId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams();
  const summary = useAccountSummary();
  const [portfolio, setPortfolio] = useState<PortfolioResponse>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [columns, setColumns] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [builder, setBuilder] = useState(false);
  const period = query.get("period") ?? "last_7d";
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setPortfolio(undefined);
    setError(undefined);
    fetch(`/api/campaigns?period=${encodeURIComponent(period)}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => undefined)) as
            { error?: { message?: string } } | undefined;
          throw new Error(body?.error?.message ?? "Meta data delayed. Silakan coba lagi.");
        }
        return (await res.json()) as PortfolioResponse;
      })
      .then((data) => {
        if (active) setPortfolio(data);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Data unavailable");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [period, attempt]);
  function update(key: string, value: string) {
    const params = new URLSearchParams(query.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== "page") params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }
  const items =
    portfolio?.campaigns.map((c) =>
      mapCampaignPortfolioItem(
        c,
        summary.data?.campaigns.find((a) => a.campaignId === c.metaId),
      ),
    ) ?? [];
  const selected = items.find((i) => i.campaign.metaId === campaignId);
  const filtered = items
    .filter(
      (i) =>
        (!query.get("q") || i.name.toLowerCase().includes((query.get("q") ?? "").toLowerCase())) &&
        (!query.get("status") || i.campaign.status === query.get("status")) &&
        (!query.get("health") || i.health === query.get("health")) &&
        (!query.get("state") || i.state === query.get("state")) &&
        (!query.get("objective") || i.campaign.objective === query.get("objective")),
    )
    .sort((a, b) =>
      query.get("sort") === "name"
        ? a.name.localeCompare(b.name)
        : b.campaign.spend - a.campaign.spend,
    );
  const page = Math.max(
    1,
    Math.min(Number(query.get("page")) || 1, Math.ceil(filtered.length / 10) || 1),
  );
  function exportCsv() {
    const rows = [
      ["Campaign", "Status", "Health", "Samantha", "Spend", "CPL"],
      ...filtered.map((i) => [
        i.name,
        i.campaign.status,
        i.health,
        i.state,
        String(i.campaign.spend),
        String(i.cpl ?? ""),
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((value) => `"${value.replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`).join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "campaign-portfolio.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <main className={styles.page}>
      <div className={styles.toolbar}>
        <Link href="/command-center">← Command Center</Link>
        <label>
          Period{" "}
          <select
            aria-label="Date range"
            value={period}
            onChange={(e) => update("period", e.target.value)}
          >
            <option value="last_7d">Last 7 days</option>
            <option value="last_14d">Last 14 days</option>
            <option value="last_30d">Last 30 days</option>
          </select>
        </label>
        <span>✧ Samantha · Campaign operations</span>
      </div>
      {!campaignId && (
        <header className={styles.heading}>
          <div>
            <small>CAMPAIGN PORTFOLIO</small>
            <h1>Campaigns</h1>
            <p>Pantau seluruh campaign dan keputusan Samantha dalam satu tempat.</p>
          </div>
          <button className={styles.primary} onClick={() => setBuilder(true)}>
            ＋ Create Campaign
          </button>
        </header>
      )}
      {error && (
        <Card>
          <p role="alert">{error}</p>
          <button onClick={() => setAttempt((n) => n + 1)}>Retry</button>
        </Card>
      )}
      {!error && !portfolio && (
        <Card>
          <LoadingState processLabel="Loading campaign portfolio..." />
        </Card>
      )}
      {portfolio?.errors.map((message) => (
        <p role="status" className={styles.notice} key={message}>
          {message} <button onClick={() => setAttempt((n) => n + 1)}>Retry</button>
        </p>
      ))}
      {summary.error && (
        <p className={styles.notice}>Assessment Samantha tertunda. Data campaign tetap tersedia.</p>
      )}
      {portfolio && !campaignId && (
        <>
          <section className={styles.summary}>
            {[
              ["Total Campaigns", items.length],
              ["Healthy", summary.data ? items.filter((i) => i.health === "HEALTHY").length : "—"],
              [
                "Need Attention",
                summary.data
                  ? items.filter((i) => ["WARNING", "CRITICAL", "WATCH"].includes(i.health)).length
                  : "—",
              ],
              [
                "Scale Opportunity",
                summary.data
                  ? items.filter((i) => i.assessment?.decision.decision === "SCALE").length
                  : "—",
              ],
              [
                "Potential Waste",
                summary.data
                  ? money(
                      items
                        .filter((i) => i.assessment?.diagnosis.rootCause === "SPEND_WITHOUT_RESULT")
                        .reduce((sum, i) => sum + i.campaign.spend, 0),
                    )
                  : "—",
              ],
            ].map(([label, value]) => (
              <Card key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
                <span className={styles.track}>
                  <i />
                </span>
              </Card>
            ))}
          </section>
          <div className={styles.filters}>
            <input
              aria-label="Search campaign"
              placeholder="Search campaign..."
              value={query.get("q") ?? ""}
              onChange={(e) => update("q", e.target.value)}
            />
            {[
              ["status", "Status", [...new Set(items.map((i) => i.campaign.status))]],
              ["health", "Health", ["HEALTHY", "WATCH", "WARNING", "CRITICAL", "UNKNOWN"]],
              ["state", "Samantha State", [...new Set(items.map((i) => i.state))]],
              ["objective", "Objective", [...new Set(items.map((i) => i.campaign.objective))]],
            ].map(([key, label, options]) => (
              <label key={String(key)}>
                {String(label)}
                <select
                  value={query.get(String(key)) ?? ""}
                  onChange={(e) => update(String(key), e.target.value)}
                >
                  <option value="">All</option>
                  {(options as string[]).map((value) => (
                    <option key={value} value={value}>
                      {presentLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label>
              Listing
              <select disabled>
                <option>Unavailable</option>
              </select>
            </label>
            <label>
              Automation
              <select disabled>
                <option>Unavailable</option>
              </select>
            </label>
          </div>
          <Card>
            <div className={styles.tableHeader}>
              <h2>Campaigns ({filtered.length})</h2>
              <button onClick={() => setColumns(!columns)}>▥ Columns</button>
              <button onClick={exportCsv}>↓ Export</button>
              <select
                aria-label="Sort campaigns"
                value={query.get("sort") ?? "spend"}
                onChange={(e) => update("sort", e.target.value)}
              >
                <option value="spend">Highest spend</option>
                <option value="name">Name</option>
              </select>
            </div>
            {columns && (
              <label className={styles.notice}>
                <input
                  type="checkbox"
                  checked={advanced}
                  onChange={(e) => setAdvanced(e.target.checked)}
                />{" "}
                Show daily budget & raw leads
              </label>
            )}
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    {[
                      "Campaign",
                      "Status",
                      "Health",
                      "Samantha State",
                      "Primary Issue / Opportunity",
                      "Spend",
                      "CPL",
                      "CPQL",
                      "Creative Health",
                      ...(advanced ? ["Daily Budget", "Raw Leads"] : []),
                      "Next Action",
                    ].map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice((page - 1) * 10, page * 10).map((item) => (
                    <tr key={item.campaign.metaId}>
                      <td>
                        <Link
                          className={styles.identity}
                          href={`/campaigns/${item.campaign.metaId}?period=${period}`}
                        >
                          <Photo item={item} />
                          <span>
                            <b>{item.name}</b>
                            <small>
                              {item.campaign.accountName} · {item.campaign.stableId}
                            </small>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <Badge
                          text={presentLabel(item.campaign.status)}
                          tone={item.campaign.status === "ACTIVE" ? "HEALTHY" : "UNKNOWN"}
                        />
                      </td>
                      <td>
                        <Badge text={presentLabel(item.health)} tone={item.health} />
                      </td>
                      <td>
                        <Badge text={item.state} tone="purple" />
                      </td>
                      <td>{item.issue}</td>
                      <td>{money(item.campaign.spend)}</td>
                      <td>{money(item.cpl)}</td>
                      <td title="Campaign CRM attribution unavailable">—</td>
                      <td>
                        {item.assessment?.health.creative.score === undefined ? (
                          "—"
                        ) : (
                          <>
                            {Math.round(item.assessment.health.creative.score)}%
                            <progress max="100" value={item.assessment.health.creative.score} />
                          </>
                        )}
                      </td>
                      {advanced && (
                        <>
                          <td>{money(item.budget)}</td>
                          <td>{item.leads}</td>
                        </>
                      )}
                      <td>
                        <Link
                          className={styles.action}
                          href={`/campaigns/${item.campaign.metaId}?period=${period}`}
                        >
                          {item.action} →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <p className={styles.notice}>Tidak ada campaign sesuai filter.</p>
            )}
            <footer className={styles.tableHeader}>
              <span>
                {filtered.length ? (page - 1) * 10 + 1 : 0}–{Math.min(page * 10, filtered.length)}{" "}
                of {filtered.length}
              </span>
              <button disabled={page <= 1} onClick={() => update("page", String(page - 1))}>
                ←
              </button>
              <span>{page}</span>
              <button
                disabled={page * 10 >= filtered.length}
                onClick={() => update("page", String(page + 1))}
              >
                →
              </button>
            </footer>
          </Card>
          <p className={styles.muted}>
            Health menggunakan assessment 7 hari terakhir pada{" "}
            {items.filter((i) => i.assessment).length} dari {items.length} campaign; campaign
            lainnya belum dinilai.
          </p>
        </>
      )}
      {portfolio &&
        campaignId &&
        (selected ? (
          <Detail
            item={selected}
            tab={tabKeys.includes(query.get("tab") ?? "") ? query.get("tab")! : "overview"}
            onTab={(value) => update("tab", value)}
          />
        ) : (
          <Card>
            <h2>Campaign belum tersedia</h2>
            <p>Campaign tidak ditemukan pada akun yang berhasil dimuat.</p>
            <Link href="/campaigns">Back to Campaigns</Link>
          </Card>
        ))}
      <Drawer open={builder} onClose={() => setBuilder(false)} title="Samantha Campaign Builder">
        <p>
          Builder tersedia pada tahap berikutnya setelah detail campaign selesai. Belum ada campaign
          yang dibuat.
        </p>
        <ol>
          {[
            "Listing",
            "Goal",
            "Budget",
            "Samantha Plan",
            "Kai Creative",
            "Preflight",
            "Review",
          ].map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Drawer>
    </main>
  );
}

function Detail({
  item,
  tab,
  onTab,
}: {
  item: CampaignView;
  tab: string;
  onTab: (tab: string) => void;
}) {
  const [evidence, setEvidence] = useState(false);
  const [history, setHistory] = useState<HistoryPoint[]>();
  const [historyError, setHistoryError] = useState(false);

  const assessment = item.assessment;
  const decision = assessment?.decision;
  useEffect(() => {
    let active = true;
    setHistory(undefined);
    setHistoryError(false);
    fetch(`/api/campaigns/${encodeURIComponent(item.campaign.metaId)}/history`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return (await r.json()) as { points: HistoryPoint[] };
      })
      .then((r) => {
        if (active) setHistory(r.points);
      })
      .catch(() => {
        if (active) setHistoryError(true);
      });
    return () => {
      active = false;
    };
  }, [item.campaign.metaId]);
  return (
    <>
      <div className={styles.breadcrumb}>
        <Link href="/campaigns">Campaigns</Link> / {item.name}
      </div>
      <header className={styles.heading}>
        <div className={styles.identity}>
          <Photo item={item} />
          <div>
            <h1>
              {item.name}{" "}
              <Badge
                text={presentLabel(item.campaign.status)}
                tone={item.campaign.status === "ACTIVE" ? "HEALTHY" : "UNKNOWN"}
              />
            </h1>
            <p>
              {presentLabel(item.campaign.objective)} · {money(item.budget)}/day · Synced{" "}
              {new Date(item.campaign.syncedAt).toLocaleTimeString("id-ID")}
            </p>
          </div>
        </div>
        <div className={styles.buttons}>
          <button disabled title="Campaign mutation integration is not available">
            Ⅱ Pause
          </button>
          <button disabled title="Editing will be available with Campaign Builder">
            Edit
          </button>
        </div>
      </header>
      <section className={styles.kpis}>
        {[
          ["Spend", money(item.campaign.spend)],
          ["Raw Leads", item.leads],
          ["Qualified Leads", "—"],
          ["CPL", money(item.cpl)],
          ["CPQL", "—"],
          ["Bookings", "—"],
        ].map(([label, value]) => (
          <Card key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
            {value === "—" && <small>Attribution unavailable</small>}
          </Card>
        ))}
      </section>
      <section className={styles.hero}>
        <Card>
          <div className={styles.tableHeader}>
            <h2>✧ Samantha Decision</h2>
            <Badge
              text={decision ? `${presentLabel(decision.impact)} impact` : "Evaluating"}
              tone={decision?.impact === "HIGH" ? "WARNING" : "purple"}
            />
            <span className={styles.confidence}>
              Confidence <b>{decision ? `${Math.round(decision.confidence * 100)}%` : "—"}</b>
            </span>
          </div>
          <div className={styles.decisionGrid}>
            <div>
              <div className={styles.diagnosis}>
                <small>Diagnosis · Recommendation</small>
                <h2>{decision?.decision === "NO_ACTION" ? "No change recommended" : item.issue}</h2>
                <p>
                  {assessment?.diagnosis.evidence[0]?.reasoning ??
                    "Samantha menunggu data yang cukup untuk menilai campaign ini."}
                </p>
              </div>
              <div className={styles.signals}>
                {assessment?.diagnosis.evidence.slice(0, 3).map((signal, i) => (
                  <div key={i}>
                    <small>{signal.metric?.toUpperCase() ?? "Signal"}</small>
                    <b>
                      {metric(signal.baselineValue, signal.metric)} →{" "}
                      {metric(signal.currentValue, signal.metric)}
                    </b>
                    {signal.deltaPct !== undefined && (
                      <span
                        className={
                          getMetricDeltaIntent(signal.metric, signal.deltaPct) === "good"
                            ? styles.good
                            : styles.bad
                        }
                      >
                        {signal.deltaPct > 0 ? "↑" : "↓"}{" "}
                        {Math.abs(signal.deltaPct * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.plan}>
              <h3>Samantha Plan</h3>
              <ol>
                <li>{decision ? presentLabel(decision.decision) : "Evaluate latest signals"}</li>
                {decision?.monitoringPlan.successConditions.slice(0, 2).map((condition, i) => (
                  <li key={i}>{presentText(condition)}</li>
                ))}
                {decision && <li>Review after {decision.monitoringPlan.reviewAfterHours} hours</li>}
              </ol>
              <p className={styles.muted}>
                Assessment ini berupa rekomendasi; status eksekusi belum terhubung.
              </p>
              <div className={styles.buttons}>
                <button onClick={() => setEvidence(true)}>View Evidence</button>
                <button disabled title="No executable approval plan is linked to this assessment">
                  Approve Plan
                </button>
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <h2>⚙ Automation</h2>
          <dl className={styles.automation}>
            <dt>Mode</dt>
            <dd>Not linked</dd>
            <dt>Current state</dt>
            <dd>{item.state}</dd>
            <dt>Review window</dt>
            <dd>
              {decision
                ? `${decision.monitoringPlan.reviewAfterHours} hours after action`
                : "Unavailable"}
            </dd>
            <dt>Success condition</dt>
            <dd>
              {decision?.monitoringPlan.successConditions.map(presentText).join(" ") ||
                "Not defined"}
            </dd>
            <dt>Rollback condition</dt>
            <dd>
              {decision?.monitoringPlan.rollbackConditions.map(presentText).join(" ") ||
                "Not defined"}
            </dd>
            <dt>Last execution</dt>
            <dd>No linked execution record</dd>
          </dl>
        </Card>
      </section>
      <nav className={styles.tabs} role="tablist" aria-label="Campaign detail tabs">
        {tabs.map((label, i) => (
          <button
            role="tab"
            aria-selected={tab === tabKeys[i]}
            key={label}
            className={tab === tabKeys[i] ? styles.activeTab : ""}
            onClick={() => onTab(tabKeys[i] ?? "overview")}
          >
            {label}
          </button>
        ))}
      </nav>
      <CampaignTabs
        item={item}
        tab={tab}
        onTab={onTab}
        history={history}
        historyError={historyError}
      />
      <Drawer open={evidence} onClose={() => setEvidence(false)} title={`Evidence · ${item.name}`}>
        <h3>{item.issue}</h3>
        <p>{decision ? presentText(decision.reason) : "Assessment belum tersedia."}</p>
        <h3>Observed signals</h3>
        {assessment?.diagnosis.evidence.map((signal, i) => (
          <p key={i}>
            <b>{presentLabel(signal.type)}</b> · {metric(signal.baselineValue, signal.metric)} →{" "}
            {metric(signal.currentValue, signal.metric)}
            <br />
            {signal.reasoning}
          </p>
        ))}
        <h3>Health dimensions</h3>
        {assessment &&
          Object.entries(assessment.health)
            .filter(([key]) => key !== "overallStatus")
            .map(
              ([key, value]) =>
                typeof value !== "string" && (
                  <p key={key}>
                    <b>{key.replace(/([A-Z])/g, " $1")}</b> · {presentLabel(value.status)} ·{" "}
                    {Math.round(value.confidence * 100)}% confidence
                    <br />
                    {value.issues.map(presentText).join(" ")}
                  </p>
                ),
            )}
        <h3>Expected outcome</h3>
        <p>{decision && presentText(decision.expectedOutcome)}</p>
        <h3>Risk of waiting</h3>
        <p>{decision && presentText(decision.riskOfDoingNothing)}</p>
        <h3>Rollback / review</h3>
        <p>
          {decision?.monitoringPlan.rollbackConditions.map(presentText).join(" ") ||
            "No rollback condition provided."}
        </p>
        <p>Review window: {decision?.monitoringPlan.reviewAfterHours ?? "—"} hours.</p>
      </Drawer>
    </>
  );
}
