"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Drawer } from "@/components/common/Drawer";
import { checkLabels } from "@/lib/listings";
import {
  dateLabel,
  detailTabs,
  mapListingDetail,
  mapListingKnowledge,
  parseDetailTab,
  type DetailWorkspace,
  type KnowledgeDocument,
  type ListingVideo,
  type DetailTab,
} from "@/lib/listing-detail";
import styles from "./ListingDetail.module.css";

async function read<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store" });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.message ?? data.error?.message ?? "Data sementara tidak tersedia.");
  return data;
}
function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className={styles.empty}>
      <span aria-hidden="true">◇</span>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.card}>
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
function Photo({ url, title, className }: { url: string; title: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  return broken ? (
    <div className={styles.imageFallback}>Foto tidak dapat dimuat</div>
  ) : (
    <img className={className} src={url} alt={title} onError={() => setBroken(true)} />
  );
}
function DocumentList({
  documents,
  compact = false,
}: {
  documents: KnowledgeDocument[];
  compact?: boolean;
}) {
  return (
    <ul className={styles.documentList}>
      {documents
        .slice(0, compact ? 5 : undefined)
        .map(mapListingKnowledge)
        .map((doc) => (
          <li key={doc.id}>
            <span className={styles.fileIcon} aria-hidden="true">
              ▤
            </span>
            <div>
              <b>{doc.name}</b>
              <small>
                {doc.type} · {doc.size}
                {!compact && ` · Diperbarui: ${doc.updated}`}
              </small>
              {doc.error && !compact && <small>{doc.error}</small>}
            </div>
            <span
              className={styles.badge}
              data-tone={doc.ready ? "green" : doc.failed ? "red" : "purple"}
            >
              {doc.status}
            </span>
          </li>
        ))}
    </ul>
  );
}

export function ListingDetailPage({ listingId }: { listingId: string }) {
  const router = useRouter();
  const query = useSearchParams();
  const tab = parseDetailTab(query.get("tab"));
  const [data, setData] = useState<DetailWorkspace>();
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [workspace, setWorkspace] = useState<{ role: string; vertical: string }>();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>();
  const [videos, setVideos] = useState<ListingVideo[]>();
  const [documentError, setDocumentError] = useState("");
  const [videoError, setVideoError] = useState("");
  const [selected, setSelected] = useState(0);
  const [preview, setPreview] = useState<number>();
  const [mediaFilter, setMediaFilter] = useState("all");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const canManage = Boolean(
    workspace?.vertical === "PROPERTY" &&
    ["owner", "manager", "superadmin"].includes(workspace.role),
  );
  const base = `/listings/${encodeURIComponent(listingId)}`;
  const edit = `${base}/edit`;
  const editorApi = `/api/listing-editor/listings/${encodeURIComponent(listingId)}`;
  const knowledgeApi = `/api/listing-editor/listing-knowledge/${encodeURIComponent(listingId)}`;
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setData(undefined);
    setSelected(0);
    read<DetailWorkspace>(
      `/api/listings/${encodeURIComponent(listingId)}/workspace`,
      controller.signal,
    )
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    read<{ role: string; vertical: string }>("/api/workspace", controller.signal)
      .then(setWorkspace)
      .catch(() => undefined);
    return () => controller.abort();
  }, [listingId, revision]);
  useEffect(() => {
    if (!canManage) return;
    const controller = new AbortController();
    const refresh = () => {
      read<{ documents: KnowledgeDocument[] }>(knowledgeApi, controller.signal)
        .then((result) => {
          setDocuments(result.documents);
          setDocumentError("");
        })
        .catch((e) => {
          if (!controller.signal.aborted) setDocumentError(e.message);
        });
      read<{ videos: ListingVideo[] }>(`${knowledgeApi}/videos`, controller.signal)
        .then((result) => {
          setVideos(result.videos);
          setVideoError("");
        })
        .catch((e) => {
          if (!controller.signal.aborted) setVideoError(e.message);
        });
    };
    refresh();
    // Reuse the editor's bounded polling pattern; signed video URLs are refreshed too.
    const timer = setInterval(refresh, 30000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [canManage, knowledgeApi]);
  const closePreview = useCallback(() => setPreview(undefined), []);
  function href(key: DetailTab) {
    return `${base}?tab=${key}`;
  }
  async function primary(photoId: string) {
    if (!data || !canManage) return;
    setBusy(true);
    setActionError("");
    try {
      const response = await fetch(`${editorApi}/photos/reorder`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          photoIds: data.listing.photos.map((p) => p.id),
          mainPhotoId: photoId,
        }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message ?? "Foto utama gagal disimpan.");
      }
      setSelected(0);
      setRevision((r) => r + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Foto utama gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return (
      <main className={styles.page}>
        <Link href="/listings">← Listings</Link>
        <Card title="Listing gagal dimuat">
          <p role="alert">{error}</p>
          <button onClick={() => setRevision((r) => r + 1)}>Coba lagi</button>
        </Card>
      </main>
    );
  if (!data)
    return (
      <main className={styles.page} aria-busy="true">
        <p role="status">Memuat listing…</p>
        <div className={styles.skeleton} />
        <div className={styles.skeletonGrid}>
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      </main>
    );
  const view = mapListingDetail(data);
  const photo = view.photos[Math.min(selected, view.photos.length - 1)];
  const activeCampaigns = view.campaigns?.filter((c) => c.status === "ACTIVE");
  const editLink = canManage ? <Link href={edit}>Edit ↗</Link> : undefined;
  const documentsContent = !canManage ? (
    <p>Akses pengelola diperlukan untuk dokumen knowledge.</p>
  ) : documentError ? (
    <p role="alert">Knowledge sementara tidak tersedia. {documentError}</p>
  ) : documents === undefined ? (
    <p role="status">Memuat knowledge…</p>
  ) : !documents.length ? (
    <Empty title="Belum ada dokumen knowledge">
      <Link href={`${edit}#knowledge`}>Upload Dokumen</Link>
    </Empty>
  ) : (
    <DocumentList documents={documents} compact={tab === "overview"} />
  );
  const summary = (
    <Card title="Informasi Utama" action={editLink}>
      <dl className={styles.info}>
        <dt>Judul listing</dt>
        <dd>{view.title}</dd>
        <dt>Harga</dt>
        <dd>
          <strong>{view.price}</strong>
        </dd>
        <dt>Jenis properti</dt>
        <dd>{view.type}</dd>
        <dt>Status listing</dt>
        <dd>{view.status}</dd>
        <dt>Sertifikat</dt>
        <dd>{view.listing.certificate || "Belum diisi"}</dd>
        <dt>Kondisi</dt>
        <dd>{view.listing.condition || "Belum diisi"}</dd>
        <dt>Tanggal dibuat</dt>
        <dd>{view.created}</dd>
        <dt>Terakhir diperbarui</dt>
        <dd>{view.updated}</dd>
      </dl>
    </Card>
  );
  const property = (
    <Card title="Detail Properti" action={editLink}>
      <div className={styles.facts}>
        {view.facts.map((f) => (
          <div key={f.label}>
            <span aria-hidden="true">⌑</span>
            <div>
              <small>{f.label}</small>
              <b>{f.value}</b>
            </div>
          </div>
        ))}
      </div>
      {!view.facts.length && <p>Spesifikasi properti belum diisi.</p>}
      {!!view.listing.highlights?.length && (
        <>
          <h3>Keunggulan dari listing</h3>
          <div className={styles.chips}>
            {view.listing.highlights.map((h, i) => (
              <span key={i}>{h}</span>
            ))}
          </div>
        </>
      )}
    </Card>
  );
  const location = (
    <Card title="Lokasi" action={editLink}>
      <p>⌖ {view.listing.address || "Alamat belum diisi"}</p>
      <p>
        {view.location} {view.listing.postalCode}
      </p>
      <small>Lokasi sesuai data listing. Koordinat dan peta terverifikasi belum tersedia.</small>
      <p>
        <Link href={href("location")}>Lihat detail lokasi →</Link>
      </p>
    </Card>
  );
  const description = (
    <Card title="Deskripsi Lengkap" action={editLink}>
      <p className={descriptionOpen ? styles.description : styles.descriptionClamped}>
        {view.listing.description || "Deskripsi belum diisi."}
      </p>
      {(view.listing.description?.length ?? 0) > 250 && (
        <button className={styles.textButton} onClick={() => setDescriptionOpen((v) => !v)}>
          {descriptionOpen ? "Tampilkan lebih sedikit" : "Tampilkan lebih banyak"}
        </button>
      )}
    </Card>
  );
  const readiness = (
    <>
      <div className={styles.readiness}>
        <strong>
          {view.readiness.checks.filter((c) => c.passed).length}
          <small>/{view.readiness.checks.length}</small>
        </strong>
        <div>
          <b>
            {view.readiness.ready
              ? "Data dasar siap untuk pemeriksaan iklan"
              : "Lengkapi kesiapan iklan"}
          </b>
          <p>Penilaian berdasarkan data listing.</p>
        </div>
      </div>
      <ul className={styles.checks}>
        {view.readiness.checks.map((c) => (
          <li key={c.name}>
            <span data-pass={c.passed}>{c.passed ? "✓" : "!"}</span>
            <div>
              {checkLabels[c.name] ?? c.name}
              {!c.passed && c.reason && <small>{c.reason}</small>}
            </div>
          </li>
        ))}
      </ul>
      <small>Kelayakan aset Meta dan pemeriksaan sebelum tayang tetap diperlukan.</small>
    </>
  );

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <Link href="/listings">⌕ Cari listing…</Link>
        <span>✧ Listing Operations</span>
      </div>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link href="/listings">Listings</Link>
        <span>›</span>
        <span>Detail Listing</span>
      </nav>
      <header className={styles.header}>
        <div className={styles.headerLine}>
          <div className={styles.meta}>
            <Link className={styles.button} href="/listings">
              ← Kembali
            </Link>
            <span
              className={styles.badge}
              data-tone={view.listing.listingStatus === "AKTIF" ? "green" : "purple"}
            >
              {view.status}
            </span>
            <span className={styles.id}>ID: {listingId}</span>
            <small>Dibuat {view.created}</small>
          </div>
          <div className={styles.actions}>
            {canManage && (
              <Link className={styles.button} href={edit}>
                ✎ Edit Listing
              </Link>
            )}
            <button title="Duplikasi belum tersedia di layanan listing" disabled>
              Duplikasi
            </button>
            {canManage && (
              <Link
                className={styles.primary}
                href={
                  activeCampaigns?.[0]
                    ? `/campaigns/${encodeURIComponent(activeCampaigns[0].id)}`
                    : `/campaigns/new?listingId=${encodeURIComponent(listingId)}`
                }
              >
                {activeCampaigns?.length ? "Lihat Campaign" : "✧ Siapkan Campaign"}
              </Link>
            )}
          </div>
        </div>
        <div className={styles.titleLine}>
          <div>
            <h1>{view.title}</h1>
            <p>
              ⌖ {view.location} <span className={styles.outlineBadge}>{view.type}</span>
            </p>
          </div>
          <div className={styles.price}>
            <strong>{view.price}</strong>
            <small>Harga sesuai listing</small>
          </div>
        </div>
      </header>
      {actionError && (
        <p role="alert" className={styles.notice}>
          {actionError}
        </p>
      )}
      <div className={styles.columns}>
        <div className={styles.main}>
          <div className={styles.tabs} role="tablist" aria-label="Detail listing">
            {detailTabs.map(([key, label], index) => (
              <Link
                key={key}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                href={href(key)}
                scroll={false}
                role="tab"
                id={`tab-${key}`}
                aria-selected={tab === key}
                aria-controls="listing-tab-panel"
                tabIndex={tab === key ? 0 : -1}
                onKeyDown={(event) => {
                  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? detailTabs.length - 1
                        : (index + (event.key === "ArrowRight" ? 1 : -1) + detailTabs.length) %
                          detailTabs.length;
                  router.push(href(detailTabs[next]![0]), { scroll: false });
                  tabRefs.current[next]?.focus();
                }}
              >
                {label}
                {key === "media" && ` (${view.photos.length + (videos?.length ?? 0)})`}
                {key === "documents" && documents && ` (${documents.length})`}
              </Link>
            ))}
          </div>
          <div
            role="tabpanel"
            id="listing-tab-panel"
            aria-labelledby={`tab-${tab}`}
            className={styles.tabContent}
          >
            {tab === "overview" && (
              <>
                <div className={styles.heroRow}>
                  <section className={styles.gallery} aria-label="Galeri listing">
                    {photo ? (
                      <>
                        <div className={styles.heroImage}>
                          <button
                            className={styles.photoOpen}
                            aria-label="Perbesar foto"
                            onClick={() => setPreview(Math.min(selected, view.photos.length - 1))}
                          >
                            <Photo url={photo.url} title={photo.label || view.title} />
                          </button>
                          <span className={styles.photoLabel}>
                            {photo.isMain ? "✦ Foto Utama" : `Foto ${selected + 1}`}
                          </span>
                          {view.photos.length > 1 && (
                            <div className={styles.galleryNav}>
                              <button
                                aria-label="Foto sebelumnya"
                                onClick={() =>
                                  setSelected(
                                    (i) => (i - 1 + view.photos.length) % view.photos.length,
                                  )
                                }
                              >
                                ‹
                              </button>
                              <button
                                aria-label="Foto berikutnya"
                                onClick={() => setSelected((i) => (i + 1) % view.photos.length)}
                              >
                                ›
                              </button>
                            </div>
                          )}
                        </div>
                        <div className={styles.thumbnails}>
                          {view.photos.slice(0, 6).map((p, i) => (
                            <button
                              key={p.id}
                              aria-label={`Lihat foto ${i + 1}`}
                              onClick={() => setSelected(i)}
                            >
                              <Photo url={p.url} title={p.label || `Foto ${i + 1}`} />
                              {i === 5 && view.photos.length > 6 && (
                                <span>+{view.photos.length - 6} foto</span>
                              )}
                            </button>
                          ))}
                          <Link href={href("media")}>▧ Semua media →</Link>
                        </div>
                      </>
                    ) : (
                      <Empty title="Belum ada media">
                        {canManage && <Link href={`${edit}#media`}>Upload Media</Link>}
                      </Empty>
                    )}
                  </section>
                  <Card title="Performa Listing">
                    <small>Meta Ads · agregasi per listing</small>
                    <div className={styles.metrics}>
                      {["Tayangan", "Klik", "Leads", "CTR"].map((label, i) => (
                        <div key={label}>
                          <span>{["◉", "↗", "♧", "⌁"][i]}</span>
                          <div>
                            <b>—</b>
                            <small>{label}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                    <small>
                      Metrik per listing belum terhubung. Data PropertyKlik dan CRM ditampilkan
                      terpisah saat tersedia.
                    </small>
                  </Card>
                </div>
                <div className={styles.cardGrid}>
                  {summary}
                  {property}
                  {location}
                  {description}
                </div>
              </>
            )}
            {tab === "property" && (
              <div className={styles.cardGrid}>
                {summary}
                {property}
                <Card title="Legal & Sertifikat" action={editLink}>
                  <p>{view.listing.certificate || "Sertifikat belum diisi"}</p>
                  <small>Informasi dari listing; belum ada hasil verifikasi legal.</small>
                </Card>
                <Card title="Utilitas" action={editLink}>
                  <dl className={styles.info}>
                    <dt>Daya listrik</dt>
                    <dd>
                      {view.listing.electricity ? `${view.listing.electricity} VA` : "Belum diisi"}
                    </dd>
                    <dt>Air & internet</dt>
                    <dd>Belum tersedia pada data listing</dd>
                  </dl>
                </Card>
                {description}
              </div>
            )}
            {tab === "location" && (
              <div className={styles.cardGrid}>
                {location}
                <Card title="Konteks Lokasi">
                  <p>Data berasal dari alamat, kecamatan, kota, dan provinsi listing.</p>
                  <Empty title="Peta dan akses sekitar belum terverifikasi">
                    <p>Jarak fasilitas, titik koordinat, dan rekomendasi radius belum tersedia.</p>
                  </Empty>
                </Card>
              </div>
            )}
            {tab === "media" && (
              <Card
                title="Media Listing"
                action={canManage && <Link href={`${edit}#media`}>＋ Kelola / Upload Media</Link>}
              >
                <div className={styles.filters}>
                  {(
                    [
                      ["all", "Semua"],
                      ["photos", "Foto"],
                      ["videos", "Video"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      aria-pressed={mediaFilter === key}
                      onClick={() => setMediaFilter(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {videoError && <p role="alert">Video sementara tidak tersedia.</p>}
                <div className={styles.mediaGrid}>
                  {mediaFilter !== "videos" &&
                    view.photos.map((p, i) => (
                      <article key={p.id}>
                        <button
                          className={styles.mediaPreview}
                          onClick={() => setPreview(i)}
                          aria-label={`Buka ${p.label || `foto ${i + 1}`}`}
                        >
                          <Photo url={p.url} title={p.label || view.title} />
                        </button>
                        <div>
                          <b>{p.label || `Foto ${i + 1}`}</b>
                          <small>{p.isMain ? "Foto utama" : "Foto listing"}</small>
                          {canManage && !p.isMain && (
                            <button disabled={busy} onClick={() => void primary(p.id)}>
                              Jadikan utama
                            </button>
                          )}
                          <a href={p.url} target="_blank" rel="noreferrer">
                            Buka file ↗
                          </a>
                        </div>
                      </article>
                    ))}
                  {mediaFilter !== "photos" &&
                    videos?.map((v) => (
                      <article key={v.id}>
                        {v.url ? (
                          <video controls preload="metadata" src={v.url} aria-label={v.fileName} />
                        ) : (
                          <Empty title="Video belum tersedia" />
                        )}
                        <div>
                          <b>{v.fileName}</b>
                          <small>Video listing</small>
                        </div>
                      </article>
                    ))}
                </div>
                {(!view.photos.length || mediaFilter === "videos") && videos?.length === 0 && (
                  <Empty title="Belum ada media pada filter ini" />
                )}
                <p className={styles.muted}>
                  Klasifikasi floorplan, peta, dan hubungan ke creative Kai belum tersedia.
                </p>
              </Card>
            )}
            {tab === "documents" && (
              <>
                <Card
                  title="Dokumen & Knowledge"
                  action={canManage && <Link href={`${edit}#knowledge`}>Kelola Dokumen →</Link>}
                >
                  {documentsContent}
                </Card>
                <div className={styles.cardGrid}>
                  <Card title="Fakta & Sumber">
                    <Empty title="Penjelajahan fakta disiapkan pada tahap berikutnya">
                      <p>
                        Dokumen berstatus siap telah diproses oleh knowledge engine. Klaim harga dan
                        promo tetap perlu ditinjau.
                      </p>
                    </Empty>
                  </Card>
                  <Card title="Konflik Knowledge">
                    <p>
                      Belum ada hasil pemeriksaan konflik yang dimuat. Ini tidak berarti dokumen
                      bebas konflik.
                    </p>
                  </Card>
                </div>
              </>
            )}
            {tab === "ai" && (
              <div className={styles.cardGrid}>
                <Card title="Kesiapan Listing">{readiness}</Card>
                <Card title="Samantha Listing Intelligence">
                  <Empty title="Analisis lengkap belum dimuat">
                    <p>
                      Lanjutkan ke editor untuk menjalankan analisis listing dan meninjau sumber
                      knowledge.
                    </p>
                    {canManage && (
                      <Link className={styles.primary} href={`${edit}#strategy`}>
                        ✧ Analisa dengan Samantha
                      </Link>
                    )}
                  </Empty>
                </Card>
                <Card title="Rencana Campaign">
                  <p>Siapkan objective dan rekomendasi Samantha sebelum membuat campaign.</p>
                  {canManage && (
                    <Link href={`/listings?listing=${encodeURIComponent(listingId)}`}>
                      Buka panel strategi listing →
                    </Link>
                  )}
                  <small>Belum ada campaign yang diterbitkan dari halaman ini.</small>
                </Card>
                <Card title="Creative & Kai">
                  <p>Hubungan creative untuk listing ini belum tersedia.</p>
                  <Link href="/kai-studio">Buka Kai Studio →</Link>
                </Card>
              </div>
            )}
            {tab === "leads" && (
              <Card title="Leads & Atribusi">
                <div className={styles.summaryMetrics}>
                  {["Total leads", "Qualified", "Appointment", "Booking"].map((l) => (
                    <div key={l}>
                      <small>{l}</small>
                      <b>—</b>
                    </div>
                  ))}
                </div>
                <Empty title="Atribusi lead per listing belum tersedia">
                  <p>
                    Lead harus terhubung melalui listing, campaign, dan creative. Angka ini belum
                    dapat disimpulkan dari daftar lead workspace.
                  </p>
                </Empty>
              </Card>
            )}
            {tab === "activity" && (
              <Card title="Aktivitas Operasional">
                <Empty title="Timeline operasional belum terhubung">
                  <p>
                    Aktivitas Samantha, Kai, campaign, dan Respon Pintar akan ditampilkan setelah
                    tersedia event dengan hubungan listing yang jelas.
                  </p>
                </Empty>
                <p>Listing dibuat: {view.created}</p>
              </Card>
            )}
            {tab === "history" && (
              <Card title="Riwayat Perubahan Listing">
                <p>
                  Terakhir diperbarui: <b>{view.updated}</b>
                </p>
                <Empty title="Versi perubahan belum tersedia">
                  <p>
                    Data saat ini belum menyimpan nilai sebelum → sesudah, pengubah, dan alasan
                    perubahan. Waktu pembaruan bukan riwayat versi.
                  </p>
                </Empty>
              </Card>
            )}
          </div>
        </div>
        <aside className={styles.rail} aria-label="Konteks operasional listing">
          <Card
            title="Status & Aksi"
            action={
              <span
                className={styles.badge}
                data-tone={view.listing.listingStatus === "AKTIF" ? "green" : "purple"}
              >
                {view.status}
              </span>
            }
          >
            <p className={styles.muted}>PropertyKlik: status publikasi belum tersedia.</p>
            <div className={styles.railActions}>
              {canManage && (
                <Link className={styles.button} href={edit}>
                  ✎ Edit Listing
                </Link>
              )}
              <button disabled title="Status nonaktif belum tersedia pada model listing">
                Nonaktifkan
              </button>
              <button disabled title="Endpoint duplikasi belum tersedia">
                Duplikasi
              </button>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    setShared(true);
                  } catch {
                    setActionError(
                      "Tautan tidak dapat disalin. Salin alamat halaman dari browser.",
                    );
                  }
                }}
              >
                {shared ? "Tautan disalin ✓" : "Salin tautan"}
              </button>
            </div>
            <small>Tautan internal memerlukan login dan akses tenant.</small>
            {canManage && (
              <Link
                className={styles.primary}
                href={
                  activeCampaigns?.[0]
                    ? `/campaigns/${encodeURIComponent(activeCampaigns[0].id)}`
                    : `/campaigns/new?listingId=${encodeURIComponent(listingId)}`
                }
              >
                {activeCampaigns?.length
                  ? "Lihat Campaign Aktif →"
                  : "✧ Siapkan Campaign dengan Samantha"}
              </Link>
            )}
            <div className={styles.railReadiness}>
              <b>{view.readiness.ready ? "Data dasar lengkap" : "Perlu dilengkapi"}</b>
              <Link href={href("ai")}>Lihat pemeriksaan →</Link>
            </div>
          </Card>
          <Card
            title={`Dokumen Pendukung${documents ? ` (${documents.length})` : ""}`}
            action={<Link href={href("documents")}>Lihat Semua</Link>}
          >
            {documentsContent}
          </Card>
          <Card title="Leads Terbaru" action={<Link href={href("leads")}>Lihat Semua</Link>}>
            <Empty title="Data lead listing belum terhubung">
              <p>Atribusi Respon Pintar / CRM belum tersedia.</p>
            </Empty>
          </Card>
          <Card title="Campaign Terhubung">
            {view.campaigns === null ? (
              <p>Hubungan campaign sementara tidak tersedia.</p>
            ) : !view.campaigns.length ? (
              <p>Belum ada campaign dengan hubungan listing tersimpan.</p>
            ) : (
              <ul className={styles.campaignList}>
                {view.campaigns.map((c) => (
                  <li key={c.id}>
                    <Link href={`/campaigns/${encodeURIComponent(c.id)}`}>{c.name} ↗</Link>
                    <small>
                      {c.status} · Sinkron {dateLabel(c.syncedAt)}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
      <Drawer open={preview !== undefined} onClose={closePreview} title="Pratinjau foto listing">
        {preview !== undefined && view.photos[preview] && (
          <div className={styles.lightbox}>
            <Photo
              url={view.photos[preview].url}
              title={view.photos[preview].label || view.title}
            />
            <p>{view.photos[preview].label || view.title}</p>
            <a href={view.photos[preview].url} target="_blank" rel="noreferrer">
              Buka file asli ↗
            </a>
          </div>
        )}
      </Drawer>
    </main>
  );
}
