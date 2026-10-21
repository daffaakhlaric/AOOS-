"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { selectPropertyInterests, type StoredInterest } from "@/lib/meta-interests";
import { draftListingStrategy } from "@/lib/listing-strategy";
import { Drawer } from "@/components/common/Drawer";
import {
  mapListingIntelligence,
  checkLabels,
  type ListingItem,
  type ListingBlueprint,
} from "@/lib/listings";
import type { GrowthObjectiveResponseDto } from "@/types/dashboard.types";
import type { KaiPackage } from "@/lib/kai-studio";
import { ListingThumbnail } from "./ListingThumbnail";
import styles from "./Listings.module.css";

export function SamanthaListingPanel({
  item,
  objectives,
  objectivesError,
  onClose,
}: {
  item: ListingItem;
  objectives: readonly GrowthObjectiveResponseDto[];
  objectivesError: boolean;
  onClose: () => void;
}) {
  const [catalogue, setCatalogue] = useState<StoredInterest[]>();
  const [catalogueError, setCatalogueError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/meta-interests", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error();
        return data as StoredInterest[];
      })
      .then((data) => {
        if (!controller.signal.aborted) setCatalogue(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setCatalogueError(true);
      });
    return () => controller.abort();
  }, []);
  const interests = selectPropertyInterests(catalogue ?? [], item.listing.propertyType);
  const [objective, setObjective] = useState("");
  const [blueprint, setBlueprint] = useState<ListingBlueprint>();
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(false),
    [revision, setRevision] = useState(0);
  const [drawer, setDrawer] = useState<"readiness" | "sources" | "plan" | undefined>();
  const [packages, setPackages] = useState<KaiPackage[]>(),
    [packagesError, setPackagesError] = useState(false);
  const [copied, setCopied] = useState(false),
    [copyError, setCopyError] = useState(false);
  useEffect(() => {
    setBlueprint(undefined);
    setError(false);
    if (!objective) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    fetch(
      `/api/listings/${encodeURIComponent(item.listing.id)}/strategy?objective=${encodeURIComponent(objective)}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<{ blueprint: ListingBlueprint }>;
      })
      .then((body) => {
        if (!controller.signal.aborted) {
          setBlueprint(body.blueprint);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [item.listing.id, objective, revision]);
  useEffect(() => {
    const controller = new AbortController();
    setPackages(undefined);
    setPackagesError(false);
    fetch("/api/creative?limit=200", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<{ packages: KaiPackage[] }>;
      })
      .then((body) => {
        if (!controller.signal.aborted)
          setPackages(body.packages.filter((p) => p.listingId === item.listing.id));
      })
      .catch(() => {
        if (!controller.signal.aborted) setPackagesError(true);
      });
    return () => controller.abort();
  }, [item.listing.id]);
  const view = mapListingIntelligence(item, blueprint);
  const draft = draftListingStrategy(item);
  const [variant, setVariant] = useState(0);
  useEffect(() => {
    setVariant(0);
    setObjective("");
  }, [item.listing.id]);
  const selectedCopy = draft.variants[variant]!;
  const phase2 = "Tersedia pada tahap berikutnya setelah review visual.";
  async function copyText() {
    try {
      await navigator.clipboard.writeText(
        [selectedCopy.primaryText, selectedCopy.headline, selectedCopy.description].join("\n\n"),
      );
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  return (
    <aside className={styles.intelligence} aria-label="Samantha Listing Intelligence">
      <header className={styles.intelligenceHeader}>
        <span className={styles.avatar}>✧</span>
        <div>
          <h2>✧ Samantha Listing Intelligence</h2>
          <p>Analisis listing dan siapkan strategi advertising.</p>
        </div>
        <span className={styles.agentBadge}>● {loading ? "Analyzing" : "AI Agent"}</span>
        <button className={styles.mobileClose} onClick={onClose} aria-label="Tutup panel Samantha">
          ×
        </button>
      </header>
      <div className={styles.selectedProperty}>
        <ListingThumbnail key={item.listing.id} urls={item.images} title={item.listing.title} />
        <div>
          <h3>{item.listing.title}</h3>
          <p>
            ⌖ {item.location} · {item.type}
          </p>
          <b>{item.price}</b>
        </div>
      </div>
      <div className={styles.objectivePicker}>
        <label htmlFor="listing-objective">Growth Objective</label>
        <select
          id="listing-objective"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
        >
          <option value="">Otomatis oleh Samantha · Qualified Leads</option>
          {objectives.map((o) => (
            <option key={o.id} value={o.id}>
              {o.targetValue} qualified leads · {o.startDate.slice(0, 10)} –{" "}
              {o.endDate.slice(0, 10)}
            </option>
          ))}
        </select>
        {objectivesError ? (
          <small role="status">Growth Objective belum dapat dimuat.</small>
        ) : (
          !objectives.length && (
            <small>Draft objective otomatis. Target angka dan budget belum disetujui.</small>
          )
        )}
      </div>
      {error && (
        <div role="status" className={styles.warning}>
          Strategi sementara belum tersedia.{" "}
          <button onClick={() => setRevision((n) => n + 1)}>Coba lagi</button>
        </div>
      )}
      <div className={styles.panelColumns} aria-busy={loading}>
        <section className={styles.panelCard}>
          <h3>◎ Objective</h3>
          <p>{loading ? "Menyiapkan strategi…" : (view.objective ?? draft.objective)}</p>
          <small>
            {view.objective ? "Rekomendasi blueprint · belum diterapkan" : draft.rationale}
          </small>
        </section>
        <section className={styles.panelCard}>
          <h3>▱ Campaign Structure</h3>
          <p>{loading ? "Menyiapkan struktur…" : (view.structure ?? draft.structure)}</p>
          <small>Draft pengujian awal; belum ada iklan yang diaktifkan.</small>
        </section>
      </div>
      <section className={styles.panelCard}>
        <h3>
          ♧ Audience Recommendation <span className={styles.draft}>Draft strategy</span>
        </h3>
        <dl className={styles.audience}>
          <dt>Usia</dt>
          <dd>{draft.audience.age}</dd>
          <dt>Radius</dt>
          <dd>{draft.audience.radiusKm} km · draft radius</dd>
          <dt>Lokasi</dt>
          <dd>{view.audience.locations || draft.audience.center || "Lengkapi lokasi listing"}</dd>
          <dt>Interest</dt>
          <dd>
            {catalogueError ? (
              <span role="status">Katalog interest belum dapat dimuat.</span>
            ) : catalogue === undefined ? (
              "Memuat katalog Meta…"
            ) : interests.length ? (
              interests.map((interest) => (
                <div key={interest.id}>
                  <strong>{interest.name}</strong>
                  <br />
                  <small>
                    ID Meta: {interest.id} · Sinkron{" "}
                    {new Date(interest.fetchedAt).toLocaleDateString("id-ID")}
                  </small>
                </div>
              ))
            ) : (
              "Belum ada interest relevan dalam katalog tenant ini."
            )}
            <small>
              Pilihan dari katalog Meta tersimpan; ketersediaan targeting perlu diperiksa ulang
              sebelum launch.
            </small>
          </dd>
          <dt>Behavior</dt>
          <dd>{draft.audience.behavior}</dd>
          <dt>Gender</dt>
          <dd>Semua</dd>
          <dt>Dasar radius</dt>
          <dd>{draft.audience.rationale}</dd>
          <dt>Strategi</dt>
          <dd>
            {view.audience.strategy ||
              "Mulai dari area listing; evaluasi kualitas lead sebelum perluasan."}
          </dd>
        </dl>
        <small>{draft.audience.validation}</small>
      </section>
      <section className={styles.panelCard}>
        <h3>▧ Creative Direction</h3>
        <p>
          {view.formats?.length
            ? view.formats.join(" · ")
            : item.listing.photos.length
              ? "Foto listing tersedia untuk rencana creative."
              : "Tambahkan foto untuk menyiapkan creative."}
        </p>
        <small>{draft.direction}</small>
        {packagesError ? (
          <p className={styles.muted}>Data Kai belum dapat dimuat.</p>
        ) : packages === undefined ? (
          <p className={styles.muted}>Menghubungkan creative…</p>
        ) : packages.length ? (
          <div className={styles.packageLinks}>
            {packages.map((p) => (
              <Link key={p.id} href={`/kai-studio?package=${encodeURIComponent(p.id)}`}>
                Buka brief Kai · {p.title} →
              </Link>
            ))}
          </div>
        ) : (
          <small>Belum ada paket Kai terkait pada 200 paket terbaru.</small>
        )}
      </section>
      <div className={styles.copyHeader}>
        <span>5 variasi draft Samantha · berbasis fakta listing</span>
        <button onClick={copyText}>{copied ? "✓ Tersalin" : "Copy"}</button>
      </div>
      {copyError && <p role="status">Clipboard tidak tersedia. Pilih teks untuk menyalinnya.</p>}
      <div className={styles.objectivePicker}>
        <label htmlFor="copy-variant">Variasi copy</label>
        <select
          id="copy-variant"
          value={variant}
          onChange={(e) => {
            setVariant(Number(e.target.value));
            setCopied(false);
          }}
        >
          {draft.variants.map((v, index) => (
            <option key={v.angle} value={index}>
              Variasi {index + 1} · {v.angle}
            </option>
          ))}
        </select>
        <small>
          Draft berbasis aturan dari data listing, belum hasil analisis model atau terbit di Meta.
          Ketersediaan multi-text mengikuti format iklan saat preflight.
        </small>
      </div>
      <div className={styles.copyGrid}>
        <section className={styles.panelCard}>
          <h3>▤ Primary Text</h3>
          <p>{selectedCopy.primaryText}</p>
        </section>
        <section className={styles.panelCard}>
          <h3>Ｔ Headline</h3>
          <p>{selectedCopy.headline}</p>
        </section>
        <section className={styles.panelCard}>
          <h3>▢ Description / Caption</h3>
          <p>{selectedCopy.description}</p>
        </section>
        <section className={styles.panelCard}>
          <h3>↗ CTA</h3>
          <p>{view.copy.destination === "WHATSAPP" ? "WhatsApp" : "Destination belum diisi"}</p>
          <small>
            {view.copy.destination
              ? "Tujuan listing · CTA Meta belum divalidasi"
              : "Lengkapi tujuan kontak terlebih dahulu"}
          </small>
        </section>
      </div>
      <section className={styles.panelCard}>
        <h3>ϟ Next Actions</h3>
        <button className={styles.readinessAction} onClick={() => setDrawer("readiness")}>
          {item.readiness.ready ? "✓ Data listing lengkap" : "⚠ Lengkapi data listing"}{" "}
          <span>
            {item.health.passed}/{item.health.total} pemeriksaan →
          </span>
        </button>
        <div className={styles.nextActions}>
          <button disabled title={phase2}>
            ✧ Send to Kai
          </button>
          <button disabled title={phase2}>
            ◎ Preview Ads
          </button>
          <button className={styles.primary} disabled title={phase2}>
            Launch with Samantha
          </button>
        </div>
        <small>
          Send to Kai, preview, dan launch masuk tahap berikutnya. Launch memerlukan preflight.
        </small>
        <button className={styles.textButton} onClick={() => setDrawer("plan")}>
          Lihat ringkasan rencana →
        </button>
      </section>
      <footer className={styles.sources}>
        <h3>♧ How Samantha Decides</h3>
        <p>
          Draft otomatis berasal dari fakta listing; Growth Objective tersimpan dapat dipilih
          sebagai override.
        </p>
        <button onClick={() => setDrawer("sources")}>▱ Listing Data</button>
        <span>Market Signal: belum tersedia</span>
        <button onClick={() => setDrawer("sources")}>◷ Campaign History</button>
      </footer>
      <Drawer
        open={drawer !== undefined}
        onClose={() => setDrawer(undefined)}
        title={
          drawer === "readiness"
            ? "Kelengkapan listing"
            : drawer === "plan"
              ? "Ringkasan rencana campaign"
              : "Sumber keputusan Samantha"
        }
      >
        {drawer === "readiness" ? (
          <>
            <p>
              Persentase kelengkapan = pemeriksaan lulus ÷ 6 × 100. Ini bukan skor AI atau jaminan
              siap launch.
            </p>
            <ul>
              {item.readiness.checks.map((c) => (
                <li key={c.name}>
                  {c.passed ? "✓" : "○"} {checkLabels[c.name] ?? "Pemeriksaan listing"}
                  {!c.passed && c.name !== "listingActive" && c.reason ? ` — ${c.reason}` : ""}
                </li>
              ))}
            </ul>
            <p>
              Foto terdaftar belum berarti kualitas visual sudah diperiksa. Akun Meta, tracking,
              kebijakan, video, dan landing page belum dinilai.
            </p>
          </>
        ) : drawer === "plan" ? (
          <>
            <h3>{item.listing.title}</h3>
            <p>{view.objective ?? draft.objective}</p>
            <p>{view.structure ?? draft.structure}</p>
            <p>
              Belum ada campaign yang dibuat dari tampilan ini. Pemeriksaan preflight dan launch
              disiapkan pada tahap berikutnya.
            </p>
            <h4>Yang perlu dilengkapi</h4>
            <ul>
              {item.readiness.checks
                .filter((c) => !c.passed)
                .map((c) => (
                  <li key={c.name}>{checkLabels[c.name]}</li>
                ))}
              <li>Validasi capability Meta dan kategori iklan</li>
              <li>Shortlist creative dan persetujuan copy</li>
              <li>Budget, akun iklan, Page, destination, dan tracking</li>
            </ul>
          </>
        ) : (
          <>
            <p>Listing diperbarui: {new Date(item.listing.updatedAt).toLocaleString("id-ID")}</p>
            <p>
              Copy disusun secara deterministik dari judul, harga, lokasi, luas, dan sertifikat yang
              terisi. Tidak memakai klaim ROI, jarak, atau fasilitas tambahan.
            </p>
            <p>Market signal dan profil qualified lead belum terhubung ke rekomendasi ini.</p>
            <h3>Campaign terhubung</h3>
            {item.health.linked === undefined ? (
              <p>Status campaign belum tersedia.</p>
            ) : item.health.linked.length ? (
              item.health.linked.map((c) => (
                <p key={c.id}>
                  <Link href={`/campaigns/${encodeURIComponent(c.id)}`}>{c.name} →</Link>
                  <small> Sinkron terakhir: {new Date(c.syncedAt).toLocaleString("id-ID")}</small>
                </p>
              ))
            ) : (
              <p>
                Belum ada campaign dengan hubungan listing yang tersimpan. Campaign lama yang belum
                dipetakan tidak termasuk.
              </p>
            )}
          </>
        )}
      </Drawer>
    </aside>
  );
}
