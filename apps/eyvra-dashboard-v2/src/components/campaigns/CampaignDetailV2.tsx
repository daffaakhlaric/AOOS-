"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Drawer } from "@/components/common/Drawer";
import { useCampaignThumbnail } from "@/components/command-center/useCampaignThumbnail";
import type { CampaignView, HistoryPoint } from "@/lib/campaigns";
import type { WorkspaceData } from "@/lib/campaign-workspace";
import { mapCampaignDetail, mapLearningGuardian } from "@/lib/campaign-detail";
import { formatIdrCompact } from "@/lib/formatters";
import { presentLabel, presentText } from "@/lib/presentation";
import { CampaignTabs } from "./CampaignTabs";
import styles from "./CampaignDetailV2.module.css";

const tabs = [
  ["overview", "Overview"],
  ["performance", "Performance"],
  ["creative", "Creative Health"],
  ["leads", "Lead Quality"],
  ["budget", "Budget"],
  ["experiments", "Experiments"],
  ["history", "History"],
  ["kai", "Kai Creative"],
];
const money = (value?: number) => (value === undefined ? "—" : formatIdrCompact(value));
const date = (value: string) =>
  Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })
    : "Belum tersedia";

export function LearningPhaseGuardianCard({
  item,
  onEvidence,
}: {
  item: CampaignView;
  onEvidence: () => void;
}) {
  const model = mapLearningGuardian(item);
  return (
    <section className={styles.guardian} aria-label="Samantha Live Operations">
      <header>
        <h2>✧ Samantha Live Operations</h2>
        <span className={styles.badge}>
          Learning Phase Guardian · {model.learning ? "Meta learning" : "Observasi"}
        </span>
      </header>
      <div className={styles.hero}>
        <div className={styles.agent} aria-hidden="true">
          ✧<small>SAMANTHA</small>
        </div>
        <div className={styles.heroCopy}>
          <small>LEARNING PHASE GUARDIAN</small>
          <h2>{model.title}</h2>
          <p>{model.description}</p>
        </div>
        <div className={styles.heroState}>
          <small>Status saat ini</small>
          <strong>{model.state}</strong>
          <small>Sumber: status campaign / ad set Meta</small>
        </div>
        <div className={styles.heroState}>
          <small>Rekomendasi Samantha</small>
          <strong>{model.recommendation}</strong>
          <small>Rekomendasi; belum dieksekusi</small>
        </div>
      </div>
      <div className={styles.facts}>
        {[
          ["Data Sufficiency", "Belum dinilai", "Menunggu model kecukupan"],
          ["Confidence", model.confidence, "Dari assessment Samantha"],
          ["Last Significant Edit", "Belum tercatat", "Riwayat edit belum tersedia"],
          ["Next Review", "Belum dijadwalkan", model.reviewWindow],
          ["Learning Risk", "Belum dinilai", "Menunggu evaluasi kebijakan"],
          ["Allowed Actions", "Belum terkonfirmasi", "Kebijakan tindakan belum terhubung"],
        ].map(([label, value, hint]) => (
          <div key={label}>
            <small>{label}</small>
            <b>{value}</b>
            <small>{hint}</small>
          </div>
        ))}
      </div>
      <div className={styles.monitoring}>
        <div>
          <h3>◷ Learning Progress</h3>
          <div className={styles.unknownProgress} />
          <p>Jendela evaluasi belum tersedia.</p>
          <small>Menunggu model kecukupan data.</small>
        </div>
        <div className={styles.success}>
          <h3>◎ Success Condition</h3>
          <p>{model.success}</p>
        </div>
        <div className={styles.rollback}>
          <h3>◇ Rollback Condition</h3>
          <p>{model.rollback}</p>
        </div>
      </div>
      <footer>
        <small>Proteksi otomatis belum terkonfirmasi oleh backend.</small>
        <button onClick={onEvidence}>▤ View Evidence</button>
      </footer>
    </section>
  );
}

export function CampaignDetailV2({
  item,
  tab,
  onTab,
}: {
  item: CampaignView;
  tab: string;
  onTab: (tab: string) => void;
}) {
  const [history, setHistory] = useState<HistoryPoint[]>();
  const [historyError, setHistoryError] = useState(false);
  const [data, setData] = useState<WorkspaceData>();
  const [dataError, setDataError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [drawer, setDrawer] = useState<"evidence" | "structure" | "controls" | "schedule">();
  const photo = useCampaignThumbnail(item.campaign.metaId);
  // Portal target so the Creative Health tab's own rail sections (Creative Actions/Insights/
  // Distribution) render INSIDE this one real right rail instead of a second, narrower nested
  // column — that second column was leaving dead space to its right and never lining up with the
  // rest of the page's rail (see `CampaignTabs`'s `creativeRailSlot` prop / the fallback it renders
  // when this hasn't mounted yet, e.g. in isolation in tests).
  const [creativeRailSlot, setCreativeRailSlot] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setHistory(undefined);
    setData(undefined);
    setDataError(false);
    setHistoryError(false);
    for (const kind of ["history", "workspace"] as const) {
      fetch(`/api/campaigns/${encodeURIComponent(item.campaign.metaId)}/${kind}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error();
          return response.json();
        })
        .then((body: WorkspaceData & { points: HistoryPoint[] }) => {
          if (!controller.signal.aborted) {
            if (kind === "history") setHistory(body.points);
            else setData(body);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            if (kind === "history") setHistoryError(true);
            else setDataError(true);
          }
        });
    }
    return () => controller.abort();
  }, [item.campaign.metaId, retry]);
  const model = mapCampaignDetail(item, data);
  const decision = item.assessment?.decision;
  return (
    <div className={styles.detail}>
      <div className={styles.breadcrumb}>
        <Link href="/campaigns">Campaigns</Link>
        <span>›</span>Campaign Detail
      </div>
      <header className={styles.heading}>
        <div>
          <h1>
            ◈ {item.name}{" "}
            <span className={styles.badge} data-live={item.campaign.status === "ACTIVE"}>
              {item.campaign.status === "ACTIVE" ? "LIVE" : presentLabel(item.campaign.status)}
            </span>
          </h1>
          <p>
            {presentLabel(item.campaign.objective)} · {item.campaign.accountName}
          </p>
          <div className={styles.context}>
            {photo.url && (
              <img src={photo.url} alt="Media terkait campaign" onError={photo.onImageError} />
            )}
            <div>
              <b>{item.campaign.stableId}</b>
              <small>
                {data?.listingId ? (
                  <Link href={`/listings/${encodeURIComponent(data.listingId)}`}>
                    Lihat listing terkait →
                  </Link>
                ) : (
                  "Listing belum ditautkan"
                )}
              </small>
            </div>
          </div>
        </div>
        <small>
          Sinkronisasi terakhir
          <br />
          {date(item.campaign.syncedAt)}
        </small>
      </header>
      {dataError || data?.errors.length ? (
        <p className={styles.notice} role="status">
          {dataError ? "Data pendukung tertunda." : data?.errors.join(" ")}{" "}
          <button onClick={() => setRetry((n) => n + 1)}>Coba lagi</button>
        </p>
      ) : null}
      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.kpis}>
            {[
              ["Spend", money(item.campaign.spend), "Periode terpilih"],
              ["Raw Leads", item.leads, "Periode terpilih"],
              ["Hot Leads", model.hotLeads ?? "—", "CRM · sepanjang waktu"],
              ["CPL", money(item.cpl), "Periode terpilih"],
              ["CPQL", "—", "Attribution belum tersedia"],
              ["Bookings", "—", "CRM belum tersedia"],
            ].map(([label, value, hint]) => (
              <div key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
                <small>{hint}</small>
              </div>
            ))}
          </section>
          <LearningPhaseGuardianCard item={item} onEvidence={() => setDrawer("evidence")} />
          <nav className={styles.tabs} aria-label="Campaign detail tabs" role="tablist">
            {tabs.map(([key, label]) => (
              <button key={key} role="tab" aria-selected={tab === key} onClick={() => onTab(key!)}>
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
            creativeRailSlot={creativeRailSlot}
          />
        </div>
        <aside className={styles.rail}>
          <section>
            <header>
              <h3>▣ Campaign Structure</h3>
              <button onClick={() => setDrawer("structure")}>View Details ›</button>
            </header>
            <div className={styles.structure}>
              <div>
                <b>1</b>
                <small>Campaign</small>
              </div>
              <span>→</span>
              <div>
                <b>{model.adSets}</b>
                <small>Ad Sets</small>
              </div>
              <span>→</span>
              <div>
                <b>{model.activeAds}</b>
                <small>Active Ads</small>
              </div>
            </div>
          </section>
          <section>
            <header>
              <h3>⚙ Campaign Controls</h3>
              <button onClick={() => setDrawer("controls")}>Details</button>
            </header>
            <dl>
              {[
                ["Objective", presentLabel(item.campaign.objective)],
                ["Total Budget", "Belum tersedia"],
                ["Daily Budget", money(item.budget)],
                ["Schedule", "Belum tersedia"],
                ["Bid Strategy", "Belum tersedia"],
                ["Active Ads", `${model.activeAds} dari ${model.ads}`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section>
            <header>
              <h3>ϟ Automation Mode</h3>
            </header>
            <b>Belum terhubung</b>
            <p>Mode dan guardrail campaign belum tersedia.</p>
            <Link href="/automation">Automation Settings →</Link>
          </section>
          <section>
            <h3>▦ Next Samantha Review</h3>
            <b>Belum dijadwalkan</b>
            <p>{model.guardian.reviewWindow}</p>
            <button onClick={() => setDrawer("schedule")}>View Schedule</button>
          </section>
          <section>
            <header>
              <h3>◷ Recent Activity</h3>
              <button onClick={() => onTab("history")}>View All ›</button>
            </header>
            {model.activity.length ? (
              <ol className={styles.timeline}>
                {model.activity.map((a) => (
                  <li key={a.id}>
                    <small>
                      {date(a.at)} · {a.agent}
                    </small>
                    <p>{a.title}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p>
                {!data && !dataError
                  ? "Memuat aktivitas…"
                  : "Belum ada aktivitas yang tertaut ke campaign ini."}
              </p>
            )}
          </section>
          <div ref={setCreativeRailSlot} />
        </aside>
      </div>
      <Drawer
        open={!!drawer}
        onClose={() => setDrawer(undefined)}
        title={
          drawer === "evidence"
            ? "Samantha · Evidence"
            : drawer === "structure"
              ? "Campaign Structure"
              : drawer === "schedule"
                ? "Review Schedule"
                : "Campaign Controls"
        }
      >
        {drawer === "evidence" && (
          <>
            <h3>{model.guardian.recommendation}</h3>
            <p>{decision ? presentText(decision.reason) : "Assessment belum tersedia."}</p>
            <p>Assessment Samantha menggunakan 7 hari terakhir; periode KPI dapat berbeda.</p>
            {item.assessment?.diagnosis.evidence.map((signal, index) => (
              <section key={index}>
                <h3>{presentLabel(signal.type)}</h3>
                <p>
                  {signal.metric}: {signal.baselineValue ?? "—"} → {signal.currentValue ?? "—"}
                </p>
                <p>{presentText(signal.reasoning)}</p>
              </section>
            ))}
            <h3>Reliabilitas & kecukupan data</h3>
            <p>
              Data sufficiency dan bukti yang bertentangan belum disediakan. Tracking:{" "}
              {presentLabel(item.assessment?.health.tracking.status ?? "UNKNOWN")}. Lead quality:{" "}
              {presentLabel(item.assessment?.health.leadQuality.status ?? "UNKNOWN")}.
            </p>
            <h3>Success / Rollback</h3>
            <p>{model.guardian.success}</p>
            <p>{model.guardian.rollback}</p>
          </>
        )}
        {drawer === "structure" &&
          item.campaign.adSets.map((set) => (
            <section key={set.metaId}>
              <h3>{set.name}</h3>
              <p>
                {presentLabel(set.status)} · {set.ads.length} ads
              </p>
              {set.ads.map((ad) => (
                <p key={ad.metaId}>
                  {ad.name} · {presentLabel(ad.status)}
                </p>
              ))}
            </section>
          ))}
        {drawer === "controls" && (
          <>
            <p>Budget harian: {money(item.budget)}</p>
            <p>Status: {presentLabel(item.campaign.status)}</p>
            <p>
              Kontrol perubahan dan persetujuan campaign belum terhubung. Belum ada perubahan
              dikirim ke Meta.
            </p>
          </>
        )}
        {drawer === "schedule" && (
          <>
            <h3>Belum dijadwalkan</h3>
            <p>{model.guardian.reviewWindow}</p>
            <p>Belum ada jadwal eksekusi yang dapat ditampilkan untuk campaign ini.</p>
          </>
        )}
      </Drawer>
    </div>
  );
}
