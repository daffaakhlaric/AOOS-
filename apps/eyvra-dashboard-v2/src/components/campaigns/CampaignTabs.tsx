"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/common/Card";
import { Drawer } from "@/components/common/Drawer";
import { formatIdrCompact } from "@/lib/formatters";
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
import styles from "./CampaignTabs.module.css";
const money = (n?: number) => (n === undefined || !Number.isFinite(n) ? "—" : formatIdrCompact(n));
const date = (s: string) =>
  new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
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
          <line x1="60" x2="700" y1={190 - 150 * n} y2={190 - 150 * n} stroke="#e5e8f2" />
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
        stroke="#7c3aed"
        strokeWidth="2.5"
      />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={190 - (v / max) * 150} r="3" fill="#7c3aed">
          <title>
            {labels[i]}: {monetary ? money(v) : v.toLocaleString("id-ID")}
          </title>
        </circle>
      ))}
      {annotations.map((a, i) => {
        const idx = labels.indexOf(a.date.slice(0, 10));
        return idx < 0 ? null : (
          <g key={i}>
            <line x1={x(idx)} x2={x(idx)} y1="25" y2="190" stroke="#bca2ff" strokeDasharray="4 4" />
            <circle cx={x(idx)} cy="25" r="5" fill="#7c3aed">
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
function Experiments({ tests }: { tests: CampaignExperiment[] }) {
  return tests.length ? (
    <div className={styles.stack}>
      {tests.map((t) => (
        <Card key={t.id}>
          <div className={styles.sectionHead}>
            <h3>{t.name}</h3>
            <span className={styles.tag}>
              {t.winnerVariantId
                ? "Winner selected"
                : t.status === "COMPLETE"
                  ? "Inconclusive"
                  : presentLabel(t.status)}
            </span>
          </div>
          <p>
            Hypothesis:{" "}
            {t.variants.map((v) => presentLabel(v.angle)).join(" vs ") || "Belum dicatat"}
          </p>
          <p className={styles.muted}>
            Perbandingan angle dari konfigurasi eksperimen. Primary metric: biaya per lead.
          </p>
          <Stats
            values={[
              ["Minimum spend / variant", money(t.thresholdSpend)],
              ["Minimum duration", `${t.thresholdDays} hari`],
              ["Minimum margin", `${t.minMarginPct}%`],
              ["Eligibility progress", `${experimentProgress(t)}%`],
            ]}
          />
          <progress max="100" value={experimentProgress(t)} />
          <div className={styles.gallery}>
            {t.variants.map((v, i) => (
              <article className={styles.creative} key={v.id}>
                <Media image={v.imageUrl} video={v.videoUrl} name={v.variantLabel} />
                <div>
                  <span className={styles.tag}>
                    {v.id === t.winnerVariantId ? "Winner" : presentLabel(v.status)}
                  </span>
                  <h3>
                    {v.variantLabel} · {presentLabel(v.angle)}
                  </h3>
                  <small>
                    {i === 0
                      ? "Reference variant (control not explicitly designated)"
                      : "Comparison variant"}
                  </small>
                  <Stats
                    values={[
                      ["Spend", money(v.spend)],
                      ["Leads", v.leads],
                      ["CPL", money(v.leads > 0 ? v.spend / v.leads : undefined)],
                    ]}
                  />
                </div>
              </article>
            ))}
          </div>
          <p className={styles.muted}>
            Progress memakai spend terendah setiap variant dan durasi. Minimum jumlah lead belum
            ditetapkan oleh konfigurasi eksperimen.
          </p>
        </Card>
      ))}
    </div>
  ) : (
    <Empty title="Belum ada eksperimen untuk campaign ini">
      Control, variants, progress, dan hasil akan tampil saat eksperimen terhubung ke campaign ini.
    </Empty>
  );
}
export function CampaignTabs({
  item,
  tab,
  onTab,
  history,
  historyError,
}: {
  item: CampaignView;
  tab: string;
  onTab: (tab: string) => void;
  history?: HistoryPoint[];
  historyError: boolean;
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
  const gallery = ads.map((ad) => {
    const pkg = packages.find(
      (p) => p.adId === ad.metaId || p.publishedMetaAdIds?.includes(ad.metaId),
    );
    const representative = item.assessment?.representativeCreative;
    const winner = tests.some((t) =>
      t.variants.some((v) => v.metaAdId === ad.metaId && v.id === t.winnerVariantId),
    );
    const status = winner
      ? "Winner"
      : pkg?.fatigueStatus === "FATIGUED"
        ? "Fatigued"
        : pkg?.fatigueStatus === "WARNING" || ad.verdict === "REFRESH"
          ? "Watch"
          : pkg?.fatigueStatus === "NORMAL" && ad.verdict === "KEEP"
            ? "Healthy"
            : "Unassessed";
    const rep = representative?.metaAdId === ad.metaId ? representative : undefined;
    return {
      ad,
      pkg,
      status,
      image:
        pkg?.imageUrls?.[0] ??
        rep?.thumbnailUrl ??
        (ad.creativeAsset ? thumbnails[ad.creativeAsset.ref] : undefined),
      video: pkg?.videoUrl ?? (rep?.kind === "VIDEO" ? rep.assetUrl : undefined),
    };
  });
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
        Lead teratribusi sepanjang waktu. HOT adalah qualified menurut Clara; tidak disamakan dengan
        booking.
      </p>
      {[
        ["CRM attributed", leads?.length],
        ["Contacted", leads?.filter((l) => l.contacted).length],
        ["Qualified · HOT", qualified],
        ["Appointment", undefined],
        ["Survey", undefined],
        ["Booking", undefined],
      ].map(([label, value]) => (
        <div className={styles.funnel} key={String(label)}>
          <span>{label}</span>
          <b>{value ?? "—"}</b>
          <div>
            <i
              style={{
                width:
                  typeof value === "number" && leads?.length
                    ? `${(value / leads.length) * 100}%`
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
      <Stats
        values={[
          [
            "Campaign score",
            item.assessment ? `${item.assessment.health.creative.score}/100` : "—",
          ],
          ["Ads", ads.length],
          ["Assessed creatives", gallery.filter((g) => g.status !== "Unassessed").length],
        ]}
      />
      <div className={styles.previewStrip}>
        {gallery.slice(0, 3).map((g) => (
          <div key={g.ad.metaId}>
            <Media image={g.image} video={g.video} name={g.ad.name} />
            <small>{g.status}</small>
          </div>
        ))}
      </div>
      <button onClick={() => onTab("creative")}>Explore creative health →</button>
    </Card>
  );
  return (
    <div className={styles.workspace}>
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
          <Card>
            <div className={styles.sectionHead}>
              <h3>Executive Summary</h3>
              <span className={styles.tag}>{item.state}</span>
            </div>
            <p>
              {item.name} menghasilkan {item.leads} raw leads dengan spend{" "}
              {money(item.campaign.spend)} dan CPL {money(item.cpl)} pada periode terpilih.
            </p>
            <p>
              {item.assessment
                ? `${item.issue}. ${presentText(item.assessment.decision.expectedOutcome)}`
                : "Samantha menunggu assessment untuk memberikan rekomendasi."}
            </p>
          </Card>
          <div className={styles.twoCol}>
            {trend}
            {creativeSummary}
            {funnel}
            <Card>
              <h3>Current Experiment</h3>
              {data?.tests ? (
                <Experiments tests={tests.filter((t) => t.status === "RUNNING").slice(0, 1)} />
              ) : (
                <p>Data eksperimen belum tersedia.</p>
              )}
              <button onClick={() => onTab("experiments")}>All experiments →</button>
            </Card>
          </div>
          <Card>
            <h3>Recent Samantha Actions</h3>
            <Timeline
              activities={activities
                .filter((a) => a.agent.toUpperCase() === "SAMANTHA")
                .slice(0, 3)}
            />
            <button onClick={() => onTab("history")}>View history →</button>
          </Card>
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
          <div className={styles.sectionHead}>
            <div>
              <h3>Creative gallery</h3>
              <p>
                Winner berasal dari eksperimen; Healthy memerlukan fatigue Normal dan verdict Keep.
                Watch/Fatigued memakai sinyal creative, bukan skor campaign.
              </p>
            </div>
            <button
              onClick={() => {
                setBrief(true);
                setNotice("");
              }}
            >
              ＋ Send to Kai
            </button>
          </div>
          <div className={styles.controls}>
            {["All", "Winner", "Healthy", "Watch", "Fatigued", "Unassessed"].map((h) => (
              <button aria-pressed={health === h} key={h} onClick={() => setHealth(h)}>
                {h} {h === "All" ? gallery.length : gallery.filter((g) => g.status === h).length}
              </button>
            ))}
          </div>
          <div className={styles.gallery}>
            {gallery
              .filter((g) => health === "All" || g.status === health)
              .map((g) => (
                <article key={g.ad.metaId} className={styles.creative}>
                  <Media image={g.image} video={g.video} name={g.ad.name} />
                  <div>
                    <span className={styles.tag} data-health={g.status}>
                      {g.status}
                    </span>
                    <h3>
                      {g.ad.stableId} · {g.ad.headline || g.ad.name}
                    </h3>
                    <p>{g.ad.primaryText}</p>
                    <Stats
                      values={[
                        [
                          "CTR",
                          g.ad.metrics.impressions
                            ? `${((g.ad.metrics.clicks / g.ad.metrics.impressions) * 100).toFixed(2)}%`
                            : "—",
                        ],
                        [
                          "CPL",
                          money(
                            g.ad.metrics.totalLead
                              ? g.ad.metrics.spend / g.ad.metrics.totalLead
                              : undefined,
                          ),
                        ],
                        ["CPQL", "—"],
                      ]}
                    />
                    <div className={styles.controls}>
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
                      <button
                        disabled={!g.pkg}
                        title={!g.pkg ? "Belum ada paket Kai yang terhubung" : undefined}
                        onClick={() => setVariant(g.pkg)}
                      >
                        Explore Variants
                      </button>
                    </div>
                  </div>
                </article>
              ))}
          </div>
          {!gallery.filter((g) => health === "All" || g.status === health).length && (
            <Empty title="Tidak ada creative sesuai filter">
              Pilih status lain untuk melihat creative campaign ini.
            </Empty>
          )}
        </>
      )}
      {tab === "leads" && (
        <>
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
              Qualified events per tanggal becameHotAt, bukan perubahan skor historis.
            </p>
            {leads ? (
              (() => {
                const counts = new Map<string, number>();
                leads.forEach((l) => {
                  const day = l.qualifiedAt?.slice(0, 10);
                  if (day) counts.set(day, (counts.get(day) ?? 0) + 1);
                });
                const days = [...counts.keys()].sort();
                return (
                  <Plot
                    title="Qualified lead events"
                    labels={days}
                    values={days.map((d) => counts.get(d) ?? 0)}
                  />
                );
              })()
            ) : (
              <p>Memuat data kualitas…</p>
            )}
          </Card>
          <Card>
            <h3>Attributed lead status</h3>
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
                  {leads?.slice(0, 50).map((l) => (
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
          </Card>
        </>
      )}
      {tab === "budget" && (
        <>
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
              <h3>Actual spend by day</h3>
              <Plot
                title="Daily spend"
                labels={(history ?? []).map((p) => p.date)}
                values={(history ?? []).map((p) => p.spend)}
                monetary
              />
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
            <h3>Samantha budget history</h3>
            <Timeline activities={budgetEvents} />
          </Card>
        </>
      )}
      {tab === "experiments" && (
        <Card>
          <div className={styles.sectionHead}>
            <h3>Campaign experiments</h3>
            <span>{tests.length} linked</span>
          </div>
          {data?.tests ? <Experiments tests={tests} /> : <p>Data eksperimen belum tersedia.</p>}
        </Card>
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
    </div>
  );
}
