"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Drawer } from "@/components/common/Drawer";
import { CopilotApprovals } from "./CopilotApprovals";
import { formatIdrCompact } from "@/lib/formatters";
import { presentLabel, presentText } from "@/lib/presentation";
import { buildCreativeGallery, CREATIVE_HEALTH_STATES } from "@/lib/creative-health";
import {
  DECISION_FILTERS,
  SAMANTHA_NAV,
  matchesDecision,
  portfolioTotals,
  rankDecisions,
  upcomingReviews,
  type DecisionFilter,
  type ReviewEvent,
} from "@/lib/samantha-portfolio";
import { stripAdNameSuffix } from "@/lib/verdict";
import type { PortfolioResponse } from "@/lib/campaigns";
import type { CampaignPackage } from "@/lib/campaign-workspace";
import type {
  AccountSummaryResponseDto,
  CampaignHealthSummaryEntryDto,
  OverviewResponseDto,
} from "@/types/dashboard.types";
import { useSamanthaResource } from "./useSamanthaResource";
import styles from "./SamanthaOverview.module.css";

const money = (n?: number) => (n === undefined ? "—" : formatIdrCompact(n));
const date = (s: string) =>
  new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
function Photo({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? (
    <img src={src} alt={name} onError={() => setFailed(true)} />
  ) : (
    <div className={styles.noPhoto}>
      ◇<small>Preview belum tersedia</small>
    </div>
  );
}
function Pending({ error }: { error?: string }) {
  return (
    <p className={styles.notice} role={error ? "alert" : "status"}>
      {error ?? "Memuat data Samantha…"}
    </p>
  );
}
function Chip({ value }: { value: string }) {
  return (
    <span className={styles.chip} data-tone={value}>
      {presentLabel(value)}
    </span>
  );
}

export function SamanthaOverview({ section = "overview" }: { section?: string }) {
  const pathname = usePathname();
  const [revision, setRevision] = useState(0),
    [period, setPeriod] = useState("last_7d"),
    [account, setAccount] = useState("all");
  const portfolio = useSamanthaResource<PortfolioResponse>(
    `/api/campaigns?period=${period}`,
    revision,
  );
  const health = useSamanthaResource<AccountSummaryResponseDto>(
    "/api/campaign-health/account-summary",
    revision,
  );
  const overview = useSamanthaResource<OverviewResponseDto>("/api/overview", revision);
  const calendar = useSamanthaResource<ReviewEvent[]>("/api/samantha/reviews", revision);
  const packages = useSamanthaResource<{ packages: CampaignPackage[] }>(
    "/api/creative?limit=200",
    revision,
  );
  const [filter, setFilter] = useState<DecisionFilter>("Semua"),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [objective, setObjective] = useState("all");
  const [creativeFilter, setCreativeFilter] = useState("Semua"),
    [insightTab, setInsightTab] = useState("Ringkasan");
  const [selected, setSelected] = useState<CampaignHealthSummaryEntryDto>();
  const campaigns = useMemo(
    () => portfolio.data?.campaigns.filter((c) => account === "all" || c.accountId === account),
    [portfolio.data, account],
  );
  const entries = useMemo(
    () =>
      rankDecisions(
        (health.data?.campaigns ?? []).filter(
          (e) => account === "all" || campaigns?.some((c) => c.metaId === e.campaignId),
        ),
      ),
    [health.data, account, campaigns],
  );
  const decisions = entries.filter((e) => matchesDecision(e, filter));
  const actions = entries.filter((e) => matchesDecision(e, "Perlu Aksi"));
  const totals = portfolioTotals(campaigns);
  const accounts = [
    ...new Map(portfolio.data?.campaigns.map((c) => [c.accountId, c.accountName])).entries(),
  ];
  const reviews = upcomingReviews(calendar.data ?? [], Date.now());
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  useEffect(() => {
    const controller = new AbortController();
    setThumbnails({});
    const grouped = new Map<string, { kind: "IMAGE" | "VIDEO"; ref: string }[]>();
    for (const c of campaigns ?? []) {
      const refs = grouped.get(c.accountId) ?? [];
      for (const a of c.adSets.flatMap((s) => s.ads))
        if (a.creativeAsset && !refs.some((r) => r.ref === a.creativeAsset?.ref))
          refs.push(a.creativeAsset);
      grouped.set(c.accountId, refs);
    }
    for (const [adAccountId, refs] of grouped)
      if (refs.length) {
        fetch("/api/creative/thumbnails", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ refs: refs.slice(0, 50), adAccountId }),
          signal: controller.signal,
        })
          .then(async (r) => {
            if (!r.ok) return;
            const b = await r.json();
            if (!controller.signal.aborted) setThumbnails((v) => ({ ...v, ...b.thumbnails }));
          })
          .catch(() => {});
      }
    return () => controller.abort();
  }, [campaigns]);
  const gallery = useMemo(
    () =>
      (campaigns ?? []).flatMap((c) => {
        const rep = health.data?.campaigns.find(
          (e) => e.campaignId === c.metaId,
        )?.representativeCreative;
        return buildCreativeGallery(
          c.adSets.flatMap((s) => s.ads),
          packages.data?.packages ?? [],
          [],
          rep,
          thumbnails,
        ).map((g) => ({
          ...g,
          status:
            rep?.metaAdId === g.ad.metaId && rep.badge
              ? rep.badge === "WINNER"
                ? "Winner"
                : "Fatigued"
              : g.status,
          campaign: c,
        }));
      }),
    [campaigns, health.data, packages.data, thumbnails],
  );
  const rows = campaigns?.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) &&
      (status === "all" || c.status === status) &&
      (objective === "all" || c.objective === objective),
  );
  const full = section === "overview";
  const errors = [...(portfolio.data?.errors ?? []), ...Object.values(health.data?.errors ?? {})];
  return (
    <main className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href="/campaigns">Campaign</Link>
        <span>›</span>Samantha
      </div>
      <header className={styles.header}>
        <div>
          <h1>
            Samantha <span>AI</span>
          </h1>
          <p>
            Meta Ads Optimizer untuk hasil yang lebih banyak Hot Leads, bukan hanya leads murah.
          </p>
        </div>
        <div className={styles.controls}>
          <select
            aria-label="Periode performa"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="last_7d">7 hari terakhir</option>
            <option value="last_14d">14 hari terakhir</option>
            <option value="last_30d">30 hari terakhir</option>
          </select>
          <select
            aria-label="Akun Meta"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          >
            <option value="all">Semua Akun Meta</option>
            {accounts.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <button className={styles.primary} onClick={() => setRevision((v) => v + 1)}>
            ↻ Muat Ulang Data
          </button>
        </div>
      </header>
      <CopilotApprovals />
      <nav className={styles.subnav} aria-label="Navigasi Samantha">
        {SAMANTHA_NAV.map(([name, href]) => (
          <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
            {name}
          </Link>
        ))}
      </nav>
      {errors.length > 0 && (
        <p className={styles.notice} role="alert">
          Sebagian sumber belum tersedia: {errors.join(" · ")}
        </p>
      )}
      {full && (
        <div className={styles.kpis}>
          {[
            ["Total Spend", money(totals?.spend), "Periode & akun terpilih"],
            ["Total Leads", totals?.leads?.toLocaleString("id-ID") ?? "—", "Leads dari Meta"],
            ["Qualified Leads", "—", "Atribusi CRM belum tersedia"],
            [
              "Hot Leads",
              account === "all" ? (overview.data?.leads?.hot?.toLocaleString("id-ID") ?? "—") : "—",
              account === "all" ? "Snapshot CRM tenant · semua periode" : "Belum tersedia per akun",
            ],
            ["Appointment", "—", "Data appointment belum tersedia"],
            ["Cost per Qualified Lead", "—", "Menunggu qualified leads"],
          ].map(([label, value, note], i) => (
            <div className={styles.kpi} key={label}>
              <span className={styles.metricIcon}>{["↗", "♧", "◈", "♨", "▦", "◎"][i]}</span>
              <div>
                <small>{label}</small>
                <strong>{value}</strong>
                <small>{note}</small>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className={styles.layout}>
        <div className={styles.main}>
          {(full || section === "decisions") && (
            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <div>
                  <h2>Samantha Decision Queue</h2>
                  <p>Rekomendasi dari analisis terakhir · belum berarti telah dieksekusi.</p>
                </div>
                <Link href="/samantha/decisions">Lihat Semua →</Link>
              </div>
              <div className={styles.filters}>
                {DECISION_FILTERS.map((f) => (
                  <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                    {f} ({health.data ? entries.filter((e) => matchesDecision(e, f)).length : "—"})
                  </button>
                ))}
              </div>
              {!health.data ? (
                <Pending error={health.error} />
              ) : (
                <>
                  <div className={styles.decisions}>
                    {decisions.slice(0, full ? 5 : undefined).map((e) => (
                      <article className={styles.decision} key={e.campaignId}>
                        <Chip value={e.decision.decision} />
                        <h3>{stripAdNameSuffix(e.campaignName)}</h3>
                        <p>{presentText(e.decision.reason)}</p>
                        <div className={styles.tags}>
                          <Chip value={e.decision.impact} />
                          <span className={styles.chip}>
                            {Math.round(e.decision.confidence * 100)}% confidence
                          </span>
                        </div>
                        <button onClick={() => setSelected(e)}>Lihat Detail</button>
                      </article>
                    ))}
                  </div>
                  {!decisions.length && (
                    <p className={styles.empty}>Belum ada keputusan untuk filter ini.</p>
                  )}
                  <small>
                    Analisis: {date(health.data.generatedAt)}
                    {health.data.campaignsCapped ? " · Cakupan campaign dibatasi backend" : ""}.
                    Filter periode berlaku untuk performa, bukan waktu analisis.
                  </small>
                </>
              )}
            </section>
          )}
          {(full || section === "audit") && (
            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <div>
                  <h2>
                    {section === "audit" ? "Ads Audit · Performa Campaign" : "Performa Campaign"}
                  </h2>
                  <p>Performa Meta dan rekomendasi Samantha untuk setiap campaign.</p>
                </div>
              </div>
              <div className={styles.controls}>
                <input
                  aria-label="Cari campaign"
                  placeholder="Cari campaign…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select
                  aria-label="Status campaign"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">Semua Status</option>
                  {[...new Set(campaigns?.map((c) => c.status))].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <select
                  aria-label="Tujuan campaign"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                >
                  <option value="all">Semua Tujuan</option>
                  {[...new Set(campaigns?.map((c) => c.objective))].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
              {!campaigns ? (
                <Pending error={portfolio.error} />
              ) : (
                <>
                  <div className={styles.tableWrap}>
                    <table>
                      <thead>
                        <tr>
                          {[
                            "Campaign",
                            "Tujuan",
                            "Status",
                            "Spend",
                            "Leads",
                            "Qualified",
                            "Hot Leads",
                            "CPQL",
                            "Samantha Decision",
                          ].map((h) => (
                            <th key={h}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows?.slice(0, full ? 5 : undefined).map((c) => {
                          const assessment = health.data?.campaigns.find(
                            (e) => e.campaignId === c.metaId,
                          );
                          return (
                            <tr key={c.accountId + c.metaId}>
                              <td>
                                <Link
                                  className={styles.campaign}
                                  href={`/campaigns/${c.metaId}?period=${period}`}
                                >
                                  <Photo
                                    src={assessment?.representativeCreative?.thumbnailUrl}
                                    name={stripAdNameSuffix(c.name)}
                                  />
                                  <span>
                                    <strong>{stripAdNameSuffix(c.name)}</strong>
                                    <small>{c.accountName}</small>
                                  </span>
                                </Link>
                              </td>
                              <td>{presentLabel(c.objective)}</td>
                              <td>
                                <Chip value={c.status} />
                              </td>
                              <td>{money(c.spend)}</td>
                              <td>{portfolioTotals([c])?.leads}</td>
                              <td>—</td>
                              <td>—</td>
                              <td>—</td>
                              <td>
                                {assessment ? (
                                  <button onClick={() => setSelected(assessment)}>
                                    {presentLabel(assessment.decision.decision)}
                                  </button>
                                ) : (
                                  <small>Belum dinilai</small>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {!rows?.length && (
                    <div className={styles.empty}>
                      Tidak ada campaign yang sesuai.{" "}
                      <Link href="/campaigns/new">Buat campaign</Link>
                    </div>
                  )}
                  <p className={styles.footnote}>
                    Qualified, Hot Leads, dan CPQL per campaign belum tersedia dalam sumber
                    portfolio.{" "}
                    {full && rows && rows.length > 5 && (
                      <Link href="/samantha/audit">Lihat seluruh {rows.length} campaign →</Link>
                    )}
                  </p>
                </>
              )}
            </section>
          )}
          {(full || section === "creative-intelligence") && (
            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <div>
                  <h2>Creative Portfolio Health</h2>
                  <p>
                    Status dari verdict tersimpan; penilaian lengkap tersedia pada detail campaign.
                  </p>
                </div>
                <Link href="/samantha/creative-intelligence">Lihat Semua →</Link>
              </div>
              <div className={styles.filters}>
                {["Semua", ...CREATIVE_HEALTH_STATES].map((s) => (
                  <button
                    key={s}
                    aria-pressed={creativeFilter === s}
                    onClick={() => setCreativeFilter(s)}
                  >
                    {s} (
                    {campaigns
                      ? gallery.filter((g) => s === "Semua" || g.status === s).length
                      : "—"}
                    )
                  </button>
                ))}
              </div>
              {packages.error && (
                <p className={styles.notice}>
                  Data QA dan fatigue Kai belum tersedia; status menggunakan verdict iklan yang
                  tersedia.
                </p>
              )}
              {!campaigns ? (
                <Pending error={portfolio.error} />
              ) : (
                <>
                  <div className={styles.gallery}>
                    {gallery
                      .filter((g) => creativeFilter === "Semua" || g.status === creativeFilter)
                      .slice(0, full ? 5 : undefined)
                      .map((g) => (
                        <Link
                          className={styles.creative}
                          key={g.campaign.metaId + g.ad.metaId}
                          href={`/campaigns/${g.campaign.metaId}?tab=creative&period=${period}`}
                        >
                          <div className={styles.creativePhoto}>
                            <Photo src={g.image} name={stripAdNameSuffix(g.ad.name)} />
                            <Chip value={g.status} />
                            {g.ad.creativeAsset?.kind === "VIDEO" && (
                              <span className={styles.video}>▶ Video</span>
                            )}
                          </div>
                          <h3>{stripAdNameSuffix(g.ad.name)}</h3>
                          <small>{stripAdNameSuffix(g.campaign.name)}</small>
                          <div className={styles.metrics}>
                            <span>
                              CTR<b>{g.ctr === undefined ? "—" : `${(g.ctr * 100).toFixed(2)}%`}</b>
                            </span>
                            <span>
                              CPL<b>{money(g.cpl)}</b>
                            </span>
                            <span>
                              CPQL<b>—</b>
                            </span>
                          </div>
                        </Link>
                      ))}
                  </div>
                  {!gallery.filter((g) => creativeFilter === "Semua" || g.status === creativeFilter)
                    .length && <p className={styles.empty}>Belum ada creative pada filter ini.</p>}
                </>
              )}
            </section>
          )}
          {section === "chat" && (
            <section className={styles.panel}>
              <h2>Chat Samantha</h2>
              <p>
                Percakapan belum terhubung di Dashboard V2. Gunakan bukti keputusan untuk meninjau
                rekomendasi yang sudah tersedia.
              </p>
              <Link href="/samantha/decisions">Buka Campaign Decisions →</Link>
            </section>
          )}
          {section === "settings" && (
            <section className={styles.panel}>
              <h2>Pengaturan Samantha</h2>
              <p>
                Pengaturan kebijakan eksekusi belum tersedia di halaman ini. Rekomendasi pada
                Overview tidak mengubah iklan atau budget.
              </p>
              <h3>Jadwal analisis minggu ini</h3>
              {!calendar.data ? (
                <Pending error={calendar.error} />
              ) : reviews.length ? (
                reviews.map((e) => (
                  <p key={e.id}>
                    {e.title} · {date(e.scheduledAt)} · {presentLabel(e.recurrence)}
                  </p>
                ))
              ) : (
                <p>Belum ada jadwal analisis mendatang yang tercatat untuk minggu ini.</p>
              )}
            </section>
          )}
        </div>
        <aside className={styles.rail}>
          <section className={styles.panel}>
            <h2>Strategi & Insight Samantha</h2>
            <div className={styles.identity}>
              <span>✧</span>
              <div>
                <strong>Samantha AI</strong>
                <p>Media Buyer · Strategist · Optimizer</p>
              </div>
            </div>
            <div className={styles.filters}>
              {["Ringkasan", "Insight", "Risiko", "Peluang"].map((t) => (
                <button key={t} aria-pressed={insightTab === t} onClick={() => setInsightTab(t)}>
                  {t}
                </button>
              ))}
            </div>
            <div className={styles.focus}>
              <h3>{insightTab === "Ringkasan" ? "Fokus dari analisis terakhir" : insightTab}</h3>
              {!health.data ? (
                <Pending error={health.error} />
              ) : insightTab === "Peluang" ? (
                <>
                  {health.data.opportunities.length ? (
                    health.data.opportunities.map((o, i) => (
                      <p key={i}>
                        {o.description}
                        <small>{o.evidence}</small>
                      </p>
                    ))
                  ) : (
                    <p>Belum ada peluang yang terkonfirmasi.</p>
                  )}
                  <small>Peluang dari ringkasan tenant; belum tersedia atribusi per akun.</small>
                </>
              ) : (
                (insightTab === "Risiko"
                  ? entries.filter(
                      (e) => e.decision.impact === "HIGH" || e.decision.impact === "CRITICAL",
                    )
                  : entries
                )
                  .slice(0, 4)
                  .map((e) => (
                    <button
                      className={styles.insight}
                      key={e.campaignId}
                      onClick={() => setSelected(e)}
                    >
                      <strong>{stripAdNameSuffix(e.campaignName)}</strong>
                      <span>
                        {presentText(
                          insightTab === "Risiko"
                            ? e.decision.riskOfDoingNothing
                            : insightTab === "Insight"
                              ? e.decision.expectedOutcome
                              : e.decision.reason,
                        )}
                      </span>
                    </button>
                  ))
              )}
              {health.data && !entries.length && insightTab !== "Peluang" && (
                <p>Belum ada analisis campaign untuk ditampilkan.</p>
              )}
            </div>
          </section>
          <section className={styles.panel}>
            <h2>Aksi Selanjutnya</h2>
            <p>Tinjau rencana dan bukti sebelum tindakan.</p>
            {!health.data ? (
              <Pending error={health.error} />
            ) : actions.length ? (
              actions.slice(0, 5).map((e) => (
                <div className={styles.next} key={e.campaignId}>
                  <span>
                    <Chip value={e.decision.decision} />
                    <small>{stripAdNameSuffix(e.campaignName)}</small>
                  </span>
                  <button onClick={() => setSelected(e)}>Review</button>
                </div>
              ))
            ) : (
              <p className={styles.empty}>Belum ada tindakan yang direkomendasikan.</p>
            )}
          </section>
          <section className={styles.panel}>
            <h2>Jadwal Review</h2>
            {!calendar.data ? (
              <Pending error={calendar.error} />
            ) : reviews[0] ? (
              <div className={styles.focus}>
                <strong>{reviews[0].title}</strong>
                <p>{date(reviews[0].scheduledAt)}</p>
                <Chip value={reviews[0].status} />
              </div>
            ) : (
              <p>Belum ada jadwal analisis mendatang yang tercatat minggu ini.</p>
            )}
            <Link href="/samantha/settings">Lihat jadwal →</Link>
            <p className={styles.footnote}>
              Jadwal tenant · bukan estimasi dari waktu halaman dibuka.
            </p>
          </section>
        </aside>
      </div>
      <Drawer
        open={!!selected}
        onClose={() => setSelected(undefined)}
        title="Bukti & Rencana Samantha"
      >
        {selected && (
          <div className={styles.evidence}>
            <h2>{selected.campaignName}</h2>
            <Chip value={selected.decision.decision} />
            <p>{presentText(selected.decision.reason)}</p>
            <h3>Diagnosis</h3>
            <p>
              {presentLabel(selected.diagnosis.rootCause ?? "UNKNOWN")} ·{" "}
              {Math.round(selected.decision.confidence * 100)}% confidence
            </p>
            <h3>Bukti</h3>
            {selected.diagnosis.evidence.length ? (
              selected.diagnosis.evidence.map((e, i) => (
                <div key={i} className={styles.focus}>
                  <strong>{presentLabel(e.type)}</strong>
                  <p>{e.reasoning}</p>
                  <p>
                    {e.metric ? presentLabel(e.metric) : "Signal"}: {e.currentValue ?? "—"} ·
                    Baseline: {e.baselineValue ?? "—"}
                  </p>
                </div>
              ))
            ) : (
              <p>Bukti rinci belum tersedia.</p>
            )}
            <h3>Risiko tanpa tindakan</h3>
            <p>{selected.decision.riskOfDoingNothing}</p>
            <h3>Hasil yang diharapkan</h3>
            <p>{selected.decision.expectedOutcome}</p>
            <h3>Rencana Monitoring</h3>
            <p>
              Review setelah {selected.decision.monitoringPlan.reviewAfterHours} jam menurut
              rencana; belum merupakan jadwal eksekusi.
            </p>
            <h3>Success conditions</h3>
            <ul>
              {selected.decision.monitoringPlan.successConditions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <h3>Rollback conditions</h3>
            <ul>
              {selected.decision.monitoringPlan.rollbackConditions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <Link className={styles.primary} href={`/campaigns/${selected.campaignId}`}>
              Buka Campaign Detail →
            </Link>
          </div>
        )}
      </Drawer>
    </main>
  );
}
