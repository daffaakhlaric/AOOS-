"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Drawer } from "@/components/common/Drawer";
import { Asset, Inspector } from "./KaiMediaInspector";
import { presentLabel } from "@/lib/presentation";
import {
  batchProgress,
  type mapKaiBriefToViewModel,
  type KaiConcept,
  type KaiDetail,
} from "@/lib/kai-studio";
import type { ListingDto } from "@/types/dashboard.types";
import type { KaiProjectDetail, KaiPersistedConcept } from "@/lib/kai-project";
import styles from "./KaiProductionWorkspace.module.css";

type Format = "Image" | "Video" | "Carousel";
type ProductionJob = {
  id: string;
  concept_id: string;
  status: string;
  error_code: string | null;
  renderMode?: "FULL" | "SAMPLE";
  assets?: {
    id: string;
    url: string;
    mimeType: string;
    previewUrl?: string;
    ratio: string;
    durationSeconds?: number;
  }[];
  qa?: { passed: boolean; checks: { check: string; passed: boolean; detail: string }[] };
};
const jobLabels: Record<string, string> = {
  SAMPLE_READY: "Sample siap ditinjau · bukan aset final",
  QUEUED: "Menunggu worker",
  SUBMITTING: "Mengirim ke KIE",
  RUNNING: "Sedang dibuat",
  INGESTING: "Menyimpan aset",
  QA: "Pemeriksaan kualitas",
  READY: "Lulus QA",
  QA_FAILED: "Perlu revisi QA",
  FAILED: "Gagal",
  CANCELLED: "Dibatalkan",
};
type Scene = {
  id: number;
  purpose: string;
  seconds: number;
  source: string;
  overlay: string;
  motion: string;
};
const steps = [
  "Brief & Strategy",
  "Konsep Creative",
  "Storyboard",
  "Generate",
  "Review & QA",
  "Finalize",
];
const stepNotes = [
  "Dari Samantha atau manual",
  "Ide, angle, dan referensi",
  "Struktur untuk image/video",
  "Produksi dengan AI",
  "Cek kualitas & fakta",
  "Pilih hasil akhir",
];
const formats: Format[] = ["Image", "Video", "Carousel"];
const money = (n?: number) =>
  typeof n === "number"
    ? new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(n)
    : "Harga belum tersedia";
interface PropertyContext extends ListingDto {
  price?: number;
  city?: string;
  province?: string;
  landArea?: number;
  buildArea?: number;
  certificate?: string;
  facilities?: string[];
}

export function KaiProductionWorkspace({
  brief,
  project,
  concepts,
  listing,
  selected,
  detail,
  detailLoading,
  detailError,
  onSelect,
  onAssets,
  onRetry,
}: {
  brief: ReturnType<typeof mapKaiBriefToViewModel>;
  project?: KaiProjectDetail;
  concepts: KaiConcept[];
  listing?: ListingDto;
  selected?: KaiConcept;
  detail?: KaiDetail;
  detailLoading: boolean;
  detailError: boolean;
  onSelect: (id: string) => void;
  onAssets: () => void;
  onRetry: () => void;
}) {
  const [plans, setPlans] = useState<KaiPersistedConcept[]>([]);
  const [planBusy, setPlanBusy] = useState(false),
    [planError, setPlanError] = useState("");
  const [planId, setPlanId] = useState<string>();
  const [jobBusy, setJobBusy] = useState(false),
    [jobMessage, setJobMessage] = useState("");
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [jobsError, setJobsError] = useState("");
  const activePlan = plans.find((p) => p.id === planId) ?? plans[0];
  useEffect(() => {
    setPlans([]);
    setPlanId(undefined);
    setPlanError("");
    setJobMessage("");
    if (!project) return;
    const controller = new AbortController();
    fetch(`/api/creative/projects/${project.project.id}/concepts`, { signal: controller.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.message);
        return body;
      })
      .then((body) => {
        if (!controller.signal.aborted) setPlans(body.concepts);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setPlanError(e.message);
      });
    return () => controller.abort();
  }, [project]);
  useEffect(() => {
    setJobs([]);
    setJobsError("");
    if (!project) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/creative/projects/${project.project.id}/jobs`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message);
        if (!controller.signal.aborted) {
          setJobs(body.jobs);
          setJobsError("");
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setJobsError(error instanceof Error ? error.message : "Status produksi gagal dimuat.");
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 10000);
      }
    };
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [project]);
  async function generateConcepts() {
    if (!project || planBusy) return;
    setPlanBusy(true);
    setPlanError("");
    try {
      const response = await fetch(`/api/creative/projects/${project.project.id}/concepts`, {
        method: "POST",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      setPlans(body.concepts);
      setStep(1);
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : "Konsep gagal dibuat.");
    } finally {
      setPlanBusy(false);
    }
  }
  const [reviewedPlan, setReviewedPlan] = useState("");
  const reviewKey = activePlan ? `${activePlan.id}:${activePlan.storyboard.revision}` : "";
  async function enqueueSelected(renderMode: "FULL" | "SAMPLE" = "FULL") {
    if (!project || !activePlan || jobBusy) return;
    if (renderMode === "FULL" && reviewedPlan !== reviewKey) return;
    setJobBusy(true);
    setJobMessage("");
    try {
      const response = await fetch(`/api/creative/projects/${project.project.id}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptIds: [activePlan.id],
          renderMode,
          reviewedRevisions: { [activePlan.id]: activePlan.storyboard.revision },
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      setJobs(body.jobs);
      setJobsError("");
      setJobMessage("Permintaan konsep terpilih tersimpan. Status produksi ditampilkan di bawah.");
    } catch (e) {
      setJobMessage(e instanceof Error ? e.message : "Antrean produksi gagal.");
    } finally {
      setJobBusy(false);
    }
  }
  const [step, setStep] = useState(0),
    [mode, setMode] = useState("Auto dari Samantha"),
    [output, setOutput] = useState<Format>("Image");
  const [gallery, setGallery] = useState("Semua"),
    [drawer, setDrawer] = useState<string>(),
    [inspect, setInspect] = useState(false);
  const [objective, setObjective] = useState(""),
    [audience, setAudience] = useState(""),
    [angles, setAngles] = useState(""),
    [tone, setTone] = useState(""),
    [cta, setCta] = useState("");
  const [quantities, setQuantities] = useState<Record<Format, number>>({
    Image: 0,
    Video: 0,
    Carousel: 0,
  });
  const [ratio, setRatio] = useState("4:5"),
    [quality, setQuality] = useState("STANDARD"),
    [duration, setDuration] = useState(15);
  const [scenes, setScenes] = useState<Scene[]>([]),
    [shortlist, setShortlist] = useState<string[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [subtitle, setSubtitle] = useState(false),
    [music, setMusic] = useState(false),
    [transition, setTransition] = useState(false);
  const l = listing as PropertyContext | undefined;
  const stats = batchProgress(concepts);
  const sources = [
    ...new Set(
      concepts
        .flatMap((c) => c.pkg.sourcePhotoUrls ?? [])
        .concat(listing?.photos?.map((p) => p.url) ?? []),
    ),
  ];
  const assets = concepts.flatMap((c) =>
    c.media.map((media) => ({ ...media, key: `${c.id}:${media.id}`, concept: c })),
  );
  const shown = assets.filter(
    (a) =>
      gallery === "Semua" ||
      (gallery === "Image" && a.kind === "image") ||
      (gallery === "Video" && a.kind === "video"),
  );
  const structured = project?.brief;
  const target =
    structured?.targetAudience.segments.join(", ") ??
    [...new Set(concepts.map((c) => c.pkg.targetPersona).filter(Boolean))].join(", ");
  const manual = mode === "Manual";
  function toggle(ids: string[], id: string) {
    return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  }
  function updateScene(id: number, patch: Partial<Scene>) {
    setScenes((old) => old.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function moveScene(index: number, delta: number) {
    setScenes((old) => {
      const next = [...old],
        other = index + delta;
      if (other < 0 || other >= next.length) return old;
      [next[index], next[other]] = [next[other]!, next[index]!];
      return next;
    });
  }
  return (
    <div className={styles.studio}>
      <div className={styles.actions}>
        <span>Kai Studio › Creative Project › {listing?.title ?? brief.title}</span>
        <button onClick={() => setDrawer("Template")}>▧ Template</button>
        <button onClick={onAssets}>▣ Asset Saya</button>
        <button onClick={() => setDrawer("Panduan")}>ⓘ Panduan</button>
        <Link className={styles.primary} href="/listings">
          ✧ Buat Creative dari Brief →
        </Link>
      </div>
      <div className={styles.contextRow}>
        <section className={`${styles.panel} ${styles.property}`}>
          <div className={styles.hero}>
            <Asset
              urls={[listing?.mainPhotoUrl, concepts[0]?.source]}
              name={listing?.title ?? brief.title}
            />
            {brief.listingId && <Link href={`/listings/${brief.listingId}`}>⌂ Lihat Listing</Link>}
          </div>
          <div>
            <h2>
              {listing?.title ?? brief.title} <span className={styles.tag}>Listing</span>
            </h2>
            <p>⌖ {[l?.city, l?.province].filter(Boolean).join(", ") || "Lokasi belum tersedia"}</p>
            <div className={styles.facts}>
              <span>▧ {l?.landArea ? `${l.landArea} m² tanah` : "Luas tanah belum tersedia"}</span>
              <span>
                ▧ {l?.buildArea ? `${l.buildArea} m² bangunan` : "Luas bangunan belum tersedia"}
              </span>
              <span>{money(l?.price)}</span>
              <span>{l?.certificate ?? "Sertifikat belum tersedia"}</span>
            </div>
            {l?.facilities?.length ? (
              <p>{l.facilities.join(" · ")}</p>
            ) : (
              <small>Fasilitas mengikuti data listing terverifikasi.</small>
            )}
          </div>
        </section>
        <section className={styles.panel}>
          <h3>Target Campaign</h3>
          <div className={styles.targetIcon}>⌘</div>
          <strong>
            {structured?.objective ??
              (selected?.pkg.adId ? "Creative terkait iklan" : "Belum terhubung campaign")}
          </strong>
          <p>
            {structured
              ? `${structured.CTA.label} · ${structured.CTA.destination}`
              : selected?.pkg.adId
                ? `Ad ID: ${selected.pkg.adId}`
                : "Objective dan destination campaign belum tercatat pada paket ini."}
          </p>
          <Link
            href={
              structured ? `/campaigns/new?draftId=${structured.campaignDraftId}` : "/campaigns"
            }
          >
            {structured ? "Kembali ke Campaign Builder →" : "Lihat Campaign →"}
          </Link>
        </section>
        <section className={`${styles.panel} ${styles.samantha}`}>
          <h3>✧ Brief dari {presentLabel(brief.origin)}</h3>
          <ul>
            <li>
              <b>Target:</b> {target || "Belum tercatat"}
            </li>
            <li>
              <b>Angle:</b> {brief.angles.map(presentLabel).join(", ") || "Belum tercatat"}
            </li>
            <li>
              <b>Format:</b>{" "}
              {structured
                ? structured.formats
                    .map((f) => `${f.quantity} ${f.type} (${f.aspectRatios.join(", ")})`)
                    .join(" · ")
                : brief.formats.map((f) => (f ? presentLabel(f) : "Belum tercatat")).join(", ")}
            </li>
            <li>
              <b>Arahan:</b> {brief.message || "Belum tercatat"}
            </li>
          </ul>
          <button onClick={() => setDrawer("Brief Lengkap")}>Lihat Brief Lengkap →</button>
        </section>
      </div>
      <nav className={styles.steps} aria-label="Tahap produksi Kai">
        {steps.map((name, i) => (
          <button
            key={name}
            aria-current={step === i ? "step" : undefined}
            onClick={() => setStep(i)}
          >
            <span>{i + 1}</span>
            <div>
              <b>{name}</b>
              <small>{stepNotes[i]}</small>
            </div>
          </button>
        ))}
      </nav>
      <div className={styles.layout} data-step={step}>
        <section className={`${styles.panel} ${styles.brief}`}>
          <h2>Creative Brief</h2>
          <div className={styles.tabs}>
            {["Auto dari Samantha", "Manual"].map((m) => (
              <button
                key={m}
                aria-pressed={mode === m}
                disabled={!!project && m === "Manual"}
                onClick={() => setMode(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <label>
            Objective
            {manual ? (
              <select value={objective} onChange={(e) => setObjective(e.target.value)}>
                <option value="">Pilih objective draft</option>
                <option>Qualified Leads</option>
                <option>Hot Lead Generation</option>
                <option>WhatsApp Leads</option>
                <option>Creative Refresh</option>
              </select>
            ) : (
              <p>{structured?.objective ?? "Belum tercatat sebagai objective terstruktur."}</p>
            )}
          </label>
          <label>
            Target Audience
            {manual ? (
              <input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Audience sesuai brief"
              />
            ) : (
              <p>{target || "Belum tercatat"}</p>
            )}
          </label>
          {structured && (
            <>
              <p>
                {structured.targetAudience.geo
                  .map((g) => `${g.name}${g.radiusKm ? ` · ${g.radiusKm} km (draft)` : ""}`)
                  .join("; ")}
              </p>
              <small>
                Persona: {structured.personas.join(" · ")}. Targeting belum divalidasi Meta.
              </small>
            </>
          )}
          <label>
            Angle Creative
            {manual ? (
              <textarea
                value={angles}
                onChange={(e) => setAngles(e.target.value)}
                placeholder="Arah konsep"
              />
            ) : (
              <div className={styles.tags}>
                {brief.angles.map((a) => (
                  <span key={a}>{presentLabel(a)}</span>
                ))}
              </div>
            )}
          </label>
          <h3>Format Output</h3>
          {formats.map((f) => (
            <label className={styles.quantity} key={f}>
              <input
                type="checkbox"
                disabled={!manual}
                checked={
                  manual
                    ? quantities[f] > 0
                    : structured
                      ? structured.formats.some((x) => x.type === f.toUpperCase())
                      : f === "Image"
                        ? brief.formats.some((x) => x?.includes("IMAGE"))
                        : f === "Video" && brief.formats.includes("VIDEO_AND_IMAGES")
                }
                onChange={(e) => setQuantities((q) => ({ ...q, [f]: e.target.checked ? 1 : 0 }))}
              />
              {f}
              <input
                aria-label={`Jumlah ${f}`}
                type="number"
                min={0}
                max={20}
                disabled={!manual}
                value={
                  manual
                    ? quantities[f]
                    : (structured?.formats.find((x) => x.type === f.toUpperCase())?.quantity ?? "")
                }
                placeholder="—"
                onChange={(e) =>
                  setQuantities((q) => ({
                    ...q,
                    [f]: Math.max(0, Math.min(20, Number(e.target.value))),
                  }))
                }
              />
            </label>
          ))}
          <small>
            {manual
              ? "Jumlah output adalah draft lokal, belum dikirim ke generator."
              : structured
                ? `${structured.conceptCount} konsep · tersimpan di brief`
                : "Jumlah per format belum tercatat. Bukan jumlah konsep."}
          </small>
          <label>
            Tone
            <input
              disabled={!manual}
              value={manual ? tone : (structured?.tone ?? "")}
              onChange={(e) => setTone(e.target.value)}
              placeholder="Belum ditentukan"
            />
          </label>
          <label>
            CTA destination
            <input
              disabled={!manual}
              value={manual ? cta : (structured?.CTA.destination ?? "")}
              onChange={(e) => setCta(e.target.value)}
              placeholder="Belum ditentukan"
            />
          </label>
          <h3>Referensi Style & Asset</h3>
          <div className={styles.references}>
            {sources.slice(0, 4).map((url, i) => (
              <button key={url} onClick={onAssets}>
                <Asset urls={[url]} name={`Referensi ${i + 1}`} />
              </button>
            ))}
          </div>
          <small>Foto sumber asli, bukan hasil generate.</small>
          <button
            className={styles.primary}
            disabled={!project || project.project.status === "NEEDS_INPUT" || planBusy}
            onClick={generateConcepts}
          >
            {planBusy
              ? "Menyusun konsep & storyboard…"
              : plans.length
                ? "Muat Konsep Tersimpan"
                : "✧ Generate Konsep Creative"}
          </button>
          <small>
            {project
              ? "Konsep dan storyboard disimpan berdasarkan brief ini. Media belum digenerasi."
              : "Buka proyek dari Campaign Builder untuk membuat konsep terstruktur."}
          </small>
          {planError && <p role="alert">{planError}</p>}
        </section>
        <div className={styles.center}>
          <section className={`${styles.panel} ${styles.concepts}`}>
            <header>
              <div>
                <h2>Konsep Creative</h2>
                <p>Arahan dari paket creative tersimpan.</p>
              </div>
              <button onClick={() => setDrawer("Ubah Konsep")}>✎ Ubah Konsep</button>
            </header>
            <div className={styles.conceptGrid}>
              {plans.map((plan) => (
                <article key={plan.id} data-selected={activePlan?.id === plan.id}>
                  <button onClick={() => setPlanId(plan.id)}>
                    <b>{plan.title}</b>
                  </button>
                  <Asset urls={plan.sourceUrls} name={plan.title} />
                  <small>
                    Foto sumber · {plan.format} · {plan.family}
                  </small>
                  <span className={styles.tag}>Usulan AI · belum diverifikasi</span>
                  <p>
                    <strong>Hipotesis untuk diuji:</strong> {plan.hypothesis}
                  </p>
                  <small>{plan.persona}</small>
                  <p>{plan.visualDirection}</p>
                  {plan.productionPipeline && (
                    <details>
                      <summary>{plan.productionPipeline.label}</summary>
                      <p>{plan.productionPipeline.reason}</p>
                      <p>{plan.productionPipeline.stages.join(" → ")}</p>
                      <small>Tahapan rencana produksi · bukan status penyelesaian</small>
                    </details>
                  )}
                </article>
              ))}
              {!plans.length &&
                concepts.map((c) => (
                  <article key={c.id} data-selected={checked.includes(c.id)}>
                    <label>
                      <b>{presentLabel(c.angle) || c.name}</b>
                      <input
                        type="checkbox"
                        aria-label={`Pilih konsep ${c.name}`}
                        checked={checked.includes(c.id)}
                        onChange={() => setChecked((ids) => toggle(ids, c.id))}
                      />
                    </label>
                    <p>{c.pkg.primaryMessage || c.pkg.reason || "Arahan belum tercatat"}</p>
                    <button
                      className={styles.visualButton}
                      onClick={() => {
                        onSelect(c.id);
                        setInspect(true);
                      }}
                    >
                      <Asset urls={[c.preview, c.source]} name={c.name} video={c.pkg.videoUrl} />
                    </button>
                    <small>
                      {c.preview ? "Hasil tersimpan" : "Foto sumber · bukan preview AI"}
                    </small>
                    <b>{c.name}</b>
                    <small>
                      {presentLabel(c.format)} · {c.pkg.targetPersona || "Persona belum tercatat"}
                    </small>
                    <span className={styles.tag}>{c.status}</span>
                  </article>
                ))}
            </div>
            {!plans.length && (
              <small>
                Hypothesis dan concept family belum tercatat; paket lama tidak diberi label
                hipotesis buatan.
              </small>
            )}
          </section>
          <section className={`${styles.panel} ${styles.storyboard}`}>
            <header>
              <div>
                <h2>Storyboard & Scene Planning</h2>
                <p>
                  {activePlan
                    ? `Storyboard tersimpan · versi ${activePlan.storyboard.revision}`
                    : "Draft manual sesi ini · belum tersimpan ke server"}
                </p>
              </div>
              <button
                disabled={!!project}
                onClick={() =>
                  setScenes((old) => [
                    ...old,
                    {
                      id: Date.now(),
                      purpose: "",
                      seconds: 3,
                      source: sources[0] ?? "",
                      overlay: "",
                      motion: "",
                    },
                  ])
                }
              >
                ＋ Tambah Scene
              </button>
            </header>
            <div className={styles.tabs}>
              {formats.map((f) => (
                <button key={f} aria-pressed={output === f} onClick={() => setOutput(f)}>
                  {f === "Image" ? "Image Set" : f}
                </button>
              ))}
            </div>
            {activePlan ? (
              <div className={styles.scenes}>
                {activePlan.storyboard.data.scenes.map((scene, i) => (
                  <article key={scene.id}>
                    <b>
                      {i + 1}. {scene.purpose}
                    </b>
                    {scene.startSeconds !== null && (
                      <small>
                        {scene.startSeconds.toFixed(1)}–{scene.endSeconds?.toFixed(1)}s
                      </small>
                    )}
                    <Asset urls={[scene.sourceUrl]} name={`Scene ${i + 1}`} />
                    <p>{scene.overlayText}</p>
                    <small>{scene.visualDirection}</small>
                    <small>Sumber: {scene.provenance.sourceLocator}</small>
                  </article>
                ))}
              </div>
            ) : !scenes.length ? (
              <div className={styles.empty}>
                <span>▧</span>
                <h3>Belum ada storyboard</h3>
                <p>
                  Pilih konsep lalu susun scene. Kai belum menghasilkan scene otomatis untuk brief
                  ini.
                </p>
                <button onClick={() => setStep(2)}>Rencanakan storyboard</button>
              </div>
            ) : (
              <div className={styles.scenes}>
                {scenes.map((scene, i) => (
                  <article key={scene.id}>
                    <header>
                      <span className={styles.tag}>{i + 1}</span>
                      <b>
                        {scenes.slice(0, i).reduce((n, s) => n + s.seconds, 0)}–
                        {scenes.slice(0, i + 1).reduce((n, s) => n + s.seconds, 0)}s
                      </b>
                      <button
                        aria-label={`Hapus scene ${i + 1}`}
                        onClick={() => setScenes((s) => s.filter((x) => x.id !== scene.id))}
                      >
                        ×
                      </button>
                    </header>
                    <Asset urls={[scene.source]} name={`Scene ${i + 1}`} />
                    <label>
                      Tujuan
                      <input
                        value={scene.purpose}
                        placeholder="Hook / reveal / CTA"
                        onChange={(e) => updateScene(scene.id, { purpose: e.target.value })}
                      />
                    </label>
                    <label>
                      Overlay
                      <input
                        value={scene.overlay}
                        onChange={(e) => updateScene(scene.id, { overlay: e.target.value })}
                      />
                    </label>
                    <label>
                      Durasi (detik)
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={scene.seconds}
                        onChange={(e) =>
                          updateScene(scene.id, {
                            seconds: Math.max(1, Math.min(30, Number(e.target.value))),
                          })
                        }
                      />
                    </label>
                    <label>
                      Visual source
                      <select
                        value={scene.source}
                        onChange={(e) => updateScene(scene.id, { source: e.target.value })}
                      >
                        <option value="">Pilih sumber</option>
                        {sources.map((u, n) => (
                          <option key={u} value={u}>
                            Foto sumber {n + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Motion
                      <input
                        value={scene.motion}
                        onChange={(e) => updateScene(scene.id, { motion: e.target.value })}
                        placeholder="Arahan gerak"
                      />
                    </label>
                    <div className={styles.tabs}>
                      <button disabled={i === 0} onClick={() => moveScene(i, -1)}>
                        ←
                      </button>
                      <button disabled={i === scenes.length - 1} onClick={() => moveScene(i, 1)}>
                        →
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
          <section className={`${styles.panel} ${styles.results}`}>
            <header>
              <h2>Hasil Generate</h2>
              <button onClick={() => setStep(5)}>Shortlist ({shortlist.length})</button>
            </header>
            <div className={styles.tabs}>
              {["Semua", ...formats].map((f) => (
                <button key={f} aria-pressed={gallery === f} onClick={() => setGallery(f)}>
                  {f} (
                  {f === "Semua"
                    ? assets.length
                    : f === "Carousel"
                      ? 0
                      : assets.filter((a) => a.kind === f.toLowerCase()).length}
                  )
                </button>
              ))}
            </div>
            {shown.length ? (
              <div className={styles.assetGrid}>
                {shown.map((a) => (
                  <article key={a.key}>
                    <button
                      className={styles.visualButton}
                      onClick={() => {
                        onSelect(a.concept.id);
                        setInspect(true);
                      }}
                    >
                      <Asset
                        urls={a.kind === "image" ? [a.url] : [a.concept.preview]}
                        video={a.kind === "video" ? a.url : undefined}
                        name={a.concept.name}
                      />
                    </button>
                    <b>{a.concept.name}</b>
                    <small>
                      {a.label} · QA {a.concept.qa.status}
                    </small>
                    <label className={styles.quantity}>
                      <input
                        type="checkbox"
                        checked={shortlist.includes(a.key)}
                        disabled={
                          a.concept.qa.status !== "Passed" ||
                          !["Ready", "Published"].includes(a.concept.status)
                        }
                        onChange={() => setShortlist((ids) => toggle(ids, a.key))}
                      />
                      Pilih untuk shortlist
                    </label>
                    <button
                      onClick={() => {
                        onSelect(a.concept.id);
                        setInspect(true);
                      }}
                    >
                      Inspect →
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <h3>
                  {gallery === "Carousel"
                    ? "Belum ada carousel tersimpan"
                    : "Belum ada hasil pada format ini"}
                </h3>
                <p>Hanya output generator yang berhasil tersimpan muncul di sini.</p>
              </div>
            )}
            <div className={styles.progress}>
              <b>Batch Progress</b>
              <span>
                {stats.ready}/{stats.total} ready · {stats.generating} generating · {stats.review}{" "}
                review
              </span>
              <progress max={stats.total || 1} value={stats.ready} />
            </div>
            {concepts
              .filter((c) => ["Generation failed", "QA Failed"].includes(c.status))
              .map((c) => (
                <p className={styles.warning} key={c.id}>
                  {c.name}: {c.status}{" "}
                  <button
                    onClick={() => {
                      onSelect(c.id);
                      setInspect(true);
                    }}
                  >
                    Lihat detail
                  </button>
                </p>
              ))}
          </section>
        </div>
        <aside className={styles.settings}>
          <section className={styles.panel}>
            <h2>Generate & Setting</h2>
            <div className={styles.tabs}>
              {formats.map((f) => (
                <button key={f} aria-pressed={output === f} onClick={() => setOutput(f)}>
                  {f}
                </button>
              ))}
            </div>
            <label>
              Model AI
              <select disabled>
                <option>{selected?.model ?? "Model registry belum tersedia"}</option>
              </select>
            </label>
            <small>
              {selected?.model
                ? "Model dari hasil terakhir, bukan pilihan model baru."
                : "Pilihan mengikuti kemampuan provider setelah terhubung."}
            </small>
            <label>
              Aspect Ratio
              <select value={ratio} onChange={(e) => setRatio(e.target.value)}>
                {["1:1", "4:5", "9:16", "16:9"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label>
              Quality Tier
              <select value={quality} onChange={(e) => setQuality(e.target.value)}>
                {["DRAFT", "STANDARD", "PREMIUM"].map((q) => (
                  <option key={q}>{q}</option>
                ))}
              </select>
            </label>
            {output === "Video" && (
              <>
                <label>
                  Durasi
                  <input
                    type="number"
                    min={3}
                    max={60}
                    value={duration}
                    onChange={(e) => setDuration(Math.max(3, Math.min(60, Number(e.target.value))))}
                  />
                </label>
                <label>
                  Voice Over
                  <select disabled>
                    <option>Tidak ada</option>
                  </select>
                </label>
                {[
                  ["Subtitle otomatis", subtitle, setSubtitle],
                  ["Musik latar", music, setMusic],
                  ["Smooth transition", transition, setTransition],
                ].map(([name, value, setter]) => (
                  <label className={styles.quantity} key={String(name)}>
                    {String(name)}
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(e) => (setter as (v: boolean) => void)(e.target.checked)}
                    />
                  </label>
                ))}
              </>
            )}
            <button
              disabled={!activePlan || jobBusy}
              onClick={() => void enqueueSelected("SAMPLE")}
            >
              ▷ Render Sample · 1 scene / image / slide
            </button>
            <small>
              Sample memakai rasio pertama. Image dan scene AI dapat memakai kredit provider;
              estimasi biaya belum tersedia.
            </small>
            <label>
              <input
                type="checkbox"
                checked={Boolean(reviewKey) && reviewedPlan === reviewKey}
                disabled={!activePlan || jobBusy}
                onChange={(event) => setReviewedPlan(event.target.checked ? reviewKey : "")}
              />{" "}
              Saya menyetujui storyboard versi {activePlan?.storyboard.revision ?? "—"} untuk
              produksi penuh. Produksi dapat memakai kredit provider; estimasi biaya belum tersedia.
            </label>
            <button
              className={styles.primary}
              disabled={!activePlan || jobBusy || reviewedPlan !== reviewKey}
              onClick={() => void enqueueSelected("FULL")}
            >
              {jobBusy ? "Memasukkan ke antrean…" : "✧ Antrekan Konsep Terpilih"}
            </button>
            <small>
              {jobMessage ||
                "Produksi berjalan di server. Hasil disimpan lalu diperiksa QA; status diperbarui otomatis."}
            </small>
            {jobsError && <small role="alert">{jobsError}</small>}
            <div aria-live="polite">
              {jobs.map((job) => (
                <div key={job.id}>
                  <strong>
                    {plans.find((plan) => plan.id === job.concept_id)?.title ?? "Konsep"}
                  </strong>
                  {" · "}
                  {jobLabels[job.status] ?? job.status}
                  {job.renderMode === "SAMPLE" && (
                    <small> · SAMPLE — tidak dikirim ke Campaign Builder</small>
                  )}
                  {job.error_code && <small> · {job.error_code}</small>}
                  {job.assets?.map((asset) => (
                    <figure key={asset.id}>
                      {asset.mimeType === "video/mp4" ? (
                        <video
                          controls
                          preload="metadata"
                          poster={asset.previewUrl}
                          src={asset.url}
                          style={{ width: "100%", maxHeight: 240 }}
                        />
                      ) : (
                        <img
                          alt="Hasil produksi untuk ditinjau"
                          src={asset.url}
                          style={{ width: "100%", maxHeight: 240, objectFit: "contain" }}
                        />
                      )}
                      <figcaption>
                        {asset.ratio}
                        {asset.durationSeconds ? ` · ${asset.durationSeconds}s` : ""} ·{" "}
                        {job.qa?.passed ? "QA lulus; lanjutkan review" : "Belum lolos QA"}
                      </figcaption>
                    </figure>
                  ))}
                  {job.qa && (
                    <details>
                      <summary>{job.qa.passed ? "Bukti QA" : "Temuan QA — perlu ditinjau"}</summary>
                      <ul>
                        {job.qa.checks.map((check, index) => (
                          <li key={`${check.check}-${index}`}>
                            {check.passed ? "✓" : "!"} {check.detail}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </section>
          <section className={styles.panel}>
            <h3>Review & QA</h3>
            <p>{selected?.name ?? "Pilih creative"}</p>
            <span className={styles.tag}>{selected?.qa.status ?? "Unavailable"}</span>
            <p>Property fidelity dan claim integrity mengikuti bukti QA yang tersimpan.</p>
            <button disabled={!selected} onClick={() => setInspect(true)}>
              Buka Inspector →
            </button>
          </section>
          <section className={styles.panel}>
            <h3>Finalize</h3>
            <p>{shortlist.length} aset dipilih pada sesi ini.</p>
            <small>
              Shortlist hanya mengizinkan aset approved dengan QA tercatat lulus. Pilihan belum
              tersimpan ke campaign.
            </small>
            {step === 5 &&
              assets
                .filter((a) => shortlist.includes(a.key))
                .map((a) => (
                  <p key={a.key}>
                    {a.concept.name} · {a.label}
                  </p>
                ))}
            <button disabled>Kirim ke Campaign</button>
            <button disabled>Kirim ke Experiment</button>
            <Link href="/samantha/stress-test/run">Buka Simulation Lab →</Link>
          </section>
        </aside>
      </div>
      <Drawer
        open={inspect && !!selected}
        onClose={() => setInspect(false)}
        title="Creative Inspector"
      >
        {selected && (
          <Inspector
            concept={selected}
            detail={detail}
            loading={detailLoading}
            error={detailError}
            previousDisabled
            nextDisabled
            onPrevious={() => {}}
            onNext={() => {}}
            onClose={() => setInspect(false)}
            onRetry={onRetry}
          />
        )}
      </Drawer>
      <Drawer open={!!drawer} onClose={() => setDrawer(undefined)} title={drawer ?? "Kai Studio"}>
        {drawer === "Brief Lengkap" ? (
          <>
            <h3>{brief.title}</h3>
            <p>{brief.reason}</p>
            <p>{brief.message}</p>
            <p>Origin: {presentLabel(brief.origin)}</p>
            {structured ? (
              <>
                <p>
                  <strong>Preserve:</strong>{" "}
                  {structured.creativeStrategy.preserve.join(" · ") || "—"}
                </p>
                <p>
                  <strong>Avoid:</strong> {structured.creativeStrategy.avoid.join(" · ") || "—"}
                </p>
                <p>
                  <strong>Explore:</strong> {structured.creativeStrategy.explore.join(" · ") || "—"}
                </p>
                <p>
                  <strong>Brand:</strong> {structured.brandRules.join(" · ") || "—"}
                </p>
              </>
            ) : (
              <p>
                Preserve / Avoid / Explore belum tercatat sebagai field terstruktur pada paket lama.
              </p>
            )}
          </>
        ) : drawer === "Ubah Konsep" ? (
          <>
            <p>
              Pilih mode Manual untuk menyiapkan arahan. Edit konsep tersimpan belum didukung
              endpoint saat ini.
            </p>
            <button
              onClick={() => {
                setMode("Manual");
                setStep(0);
                setDrawer(undefined);
              }}
            >
              Buka brief manual
            </button>
          </>
        ) : drawer === "Template" ? (
          <p>
            Library template belum terhubung. Gunakan foto listing sebagai referensi dan susun
            storyboard manual.
          </p>
        ) : (
          <>
            <p>Brief → Konsep → Storyboard → Generate → Review & QA → Finalize.</p>
            <p>
              Paket dan output lama tetap tersedia. Draft manual, storyboard, pengaturan, dan
              shortlist hanya berada di sesi ini; tidak mengubah data server.
            </p>
            <p>
              Generate baru dengan pengaturan studio dan publikasi diaktifkan setelah integrasi
              produksi. Foto referensi tidak dianggap hasil AI.
            </p>
          </>
        )}
      </Drawer>
    </div>
  );
}
