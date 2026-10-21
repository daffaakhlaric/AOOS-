"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MetaLeadDestination } from "./MetaLeadDestination";
import styles from "./ListingEditor.module.css";
type Photo = { id: string; url: string; isMain: boolean };
type Doc = {
  id: string;
  file_name: string;
  status: string;
  error_code?: string;
  size_bytes: number;
};
type Video = { id: string; fileName: string; url: string | null };
type Form = Record<string, string>;
type Saved = { id: string; listingStatus: string; photos: Photo[]; [key: string]: unknown };
type Analysis = {
  analysisAvailable?: boolean;
  strategy?: { angles: string[]; location: string | null };
  retrievalMode: string;
  copy: { primaryText: string; headline: string; cta: string | null };
  sources: {
    documentId: string;
    fileName: string;
    location: { page?: number; sheet?: string; rowStart?: number };
    excerpt: string;
  }[];
  warnings: string[];
  conflicts: unknown[];
};
type Upload = {
  file: File;
  kind: "photos" | "documents" | "videos";
  progress: number;
  error?: string;
  done?: boolean;
};
const numeric = new Set([
  "price",
  "landArea",
  "buildArea",
  "bedrooms",
  "bathrooms",
  "floors",
  "garage",
  "electricity",
]);
async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch("/api/listing-editor/" + path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Permintaan gagal");
  return data as T;
}
export function ListingEditor({ listingId }: { listingId?: string }) {
  const [form, setForm] = useState<Form>({
    title: "",
    propertyType: "",
    price: "",
    description: "",
  });
  const [saved, setSaved] = useState<Saved>();
  const id = useRef(listingId);
  const [photos, setPhotos] = useState<Photo[]>([]),
    [docs, setDocs] = useState<Doc[]>([]),
    [videos, setVideos] = useState<Video[]>([]);
  const [config, setConfig] = useState<{ formats: string[]; maxBytes: number }>();
  const [knowledgeError, setKnowledgeError] = useState("");
  const [workspace, setWorkspace] = useState<{
    email?: string;
    tenantId: string;
    vertical: string;
  }>();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("Form belum disimpan."),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState(false),
    [uploads, setUploads] = useState<Upload[]>([]),
    [analysis, setAnalysis] = useState<Analysis>();
  const [step, setStep] = useState(0);
  const saveLock = useRef<Promise<string>>();
  useEffect(() => {
    fetch("/api/workspace", { cache: "no-store" })
      .then(async (response) => {
        if (response.ok) setWorkspace(await response.json());
      })
      .catch(() => undefined);
    api<{ formats: string[]; maxBytes: number }>("listing-knowledge/config")
      .then(setConfig)
      .catch((e) => setKnowledgeError(e.message || "Konfigurasi knowledge belum tersedia."));
    if (listingId)
      api<Saved>("listings/" + listingId)
        .then((data) => {
          setSaved(data);
          setPhotos(data.photos ?? []);
          const values: Form = {};
          for (const [key, value] of Object.entries(data))
            if (typeof value === "string" || typeof value === "number") values[key] = String(value);
          if (values.propertyType === "UNSPECIFIED") values.propertyType = "";
          if (values.price === "0") values.price = "";
          setForm(values);
          setMessage("Listing tersimpan.");
        })
        .catch((e) => setError(e.message));
  }, [listingId]);
  useEffect(() => {
    if (!saved?.id) return;
    let stopped = false;
    const refresh = () => {
      api<{ documents: Doc[] }>("listing-knowledge/" + saved.id)
        .then((data) => {
          if (!stopped) {
            setDocs(data.documents);
            setKnowledgeError("");
          }
        })
        .catch((e) => {
          if (!stopped) setKnowledgeError(e.message);
        });
      api<{ videos: Video[] }>("listing-knowledge/" + saved.id + "/videos")
        .then((data) => {
          if (!stopped) setVideos(data.videos);
        })
        .catch(() => undefined);
    };
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [saved?.id]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function change(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
    setAnalysis(undefined);
    setMessage("Perubahan belum disimpan.");
  }
  function payload() {
    const result: Record<string, string | number | null> = {};
    const allowed = [
      "title",
      "propertyType",
      "price",
      "description",
      "landArea",
      "buildArea",
      "bedrooms",
      "bathrooms",
      "floors",
      "garage",
      "certificate",
      "condition",
      "electricity",
      "facing",
      "address",
      "city",
      "province",
      "kecamatan",
      "postalCode",
      "waNumber",
      "metaPageId",
      "metaAdAccountId",
    ];
    for (const key of allowed) {
      const value = form[key]?.trim();
      if (value) result[key] = numeric.has(key) ? Number(value) : value;
      else if (!["title", "propertyType", "price"].includes(key) && saved?.[key] !== undefined)
        result[key] = null;
    }
    return result;
  }
  async function persist() {
    if (saveLock.current) return saveLock.current;
    if (!form.title?.trim()) throw new Error("Isi judul listing sebelum menyimpan atau upload.");
    const promise = (async () => {
      const data = await api<Saved>(
        id.current
          ? "listings/" + id.current + (saved?.listingStatus === "DRAFT" ? "/draft" : "")
          : "listings/drafts",
        id.current ? "PUT" : "POST",
        payload(),
      );
      id.current = data.id;
      setSaved(data);
      setPhotos(data.photos);
      setDirty(false);
      setMessage(
        "Draft tersimpan · " +
          new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      );
      if (!listingId) window.history.replaceState(null, "", "/listings/" + data.id + "/edit");
      return data.id;
    })();
    saveLock.current = promise;
    try {
      return await promise;
    } finally {
      saveLock.current = undefined;
    }
  }
  async function action(kind: "draft" | "save" | "analyze") {
    setBusy(true);
    setError("");
    try {
      const listing = await persist();
      if (kind === "save") {
        const data = await api<Saved>("listings/" + listing + "/finish", "POST");
        setSaved(data);
        setMessage("Listing berhasil disimpan. Kesiapan iklan diperiksa terpisah.");
        setStep(4);
      }
      if (kind === "analyze") {
        const data = await api<Analysis>("listing-knowledge/" + listing + "/analyze", "POST");
        setAnalysis(data);
        setStep(3);
        setMessage("Analisis fakta dan sumber tersedia untuk ditinjau.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Permintaan gagal");
    } finally {
      setBusy(false);
    }
  }
  function uploadRequest(path: string, file: File, onProgress: (n: number) => void) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/listing-editor/" + path);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.timeout = 120000;
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else {
          let reason = "Upload gagal";
          try {
            reason = JSON.parse(xhr.responseText).message || reason;
          } catch {}
          reject(new Error(reason));
        }
      };
      xhr.onerror = () => reject(new Error("Koneksi upload terputus"));
      xhr.ontimeout = () => reject(new Error("Upload melewati batas waktu"));
      const data = new FormData();
      data.append("file", file);
      xhr.send(data);
    });
  }
  async function sendUpload(task: Upload, listing: string) {
    const update = (patch: Partial<Upload>) =>
      setUploads((list) =>
        list.map((t) => (t === task || t.file === task.file ? { ...t, ...patch } : t)),
      );
    try {
      update({ error: undefined, progress: 0 });
      await uploadRequest(
        task.kind === "photos"
          ? "listings/" + listing + "/photos"
          : "listing-knowledge/" + listing + (task.kind === "videos" ? "/videos" : ""),
        task.file,
        (n) => update({ progress: n }),
      );
      update({ done: true });
      const result = await api<Saved>("listings/" + listing);
      setPhotos(result.photos);
      if (task.kind === "documents") {
        const result = await api<{ documents: Doc[] }>("listing-knowledge/" + listing);
        setDocs(result.documents);
      }
      if (task.kind === "videos") {
        const result = await api<{ videos: Video[] }>("listing-knowledge/" + listing + "/videos");
        setVideos(result.videos);
      }
    } catch (e) {
      update({ error: e instanceof Error ? e.message : "Upload gagal" });
    }
  }
  async function upload(files: FileList | File[], kind: Upload["kind"]) {
    setBusy(true);
    setError("");
    try {
      const listing = await persist();
      const tasks = Array.from(files).map((file) => ({ file, kind, progress: 0 }));
      setUploads((list) => [...list, ...tasks]);
      for (const task of tasks) await sendUpload(task, listing);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload gagal");
    } finally {
      setBusy(false);
    }
  }
  async function mediaAction(path: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(path, method, body);
      const result = await api<Saved>("listings/" + id.current);
      setPhotos(result.photos);
      if (path.includes("listing-knowledge")) {
        const [knowledge, media] = await Promise.all([
          api<{ documents: Doc[] }>("listing-knowledge/" + id.current),
          api<{ videos: Video[] }>("listing-knowledge/" + id.current + "/videos"),
        ]);
        setDocs(knowledge.documents);
        setVideos(media.videos);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Permintaan gagal");
    } finally {
      setBusy(false);
    }
  }
  const checks = [
    ["Informasi dasar", Boolean(form.title && form.propertyType && Number(form.price) > 0)],
    [
      "Detail properti",
      Boolean(
        form.certificate && (form.propertyType === "APARTEMEN" ? form.buildArea : form.landArea),
      ),
    ],
    ["Lokasi", Boolean(form.address && form.city)],
    ["Tujuan lead", Boolean(form.waNumber)],
    ["Media foto", photos.length > 0],
    ["Knowledge siap", docs.some((d) => d.status === "READY")],
  ] as const;
  const ready = Math.round((checks.filter((c) => c[1]).length / checks.length) * 100);
  const type = form.propertyType;
  const processing = docs.some((d) => !["READY", "FAILED", "OCR_REQUIRED"].includes(d.status));
  function field(key: string, label: string, options?: string[], wide = false) {
    return (
      <label className={wide ? styles.wide : undefined} key={key}>
        <span>{label}</span>
        {options ? (
          <select
            value={form[key] ?? ""}
            disabled={busy}
            onChange={(e) => change(key, e.target.value)}
          >
            <option value="">Pilih {label.toLowerCase()}</option>
            {options.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        ) : key === "description" ? (
          <textarea
            maxLength={2000}
            rows={4}
            value={form[key] ?? ""}
            onChange={(e) => change(key, e.target.value)}
            disabled={busy}
          />
        ) : (
          <input
            type={numeric.has(key) ? "number" : "text"}
            min={numeric.has(key) ? 0 : undefined}
            value={form[key] ?? ""}
            disabled={busy}
            onChange={(e) => change(key, e.target.value)}
            onBlur={() => {
              if (key === "title" && !id.current && form.title?.trim()) void action("draft");
            }}
          />
        )}
      </label>
    );
  }
  function dropzone(kind: Upload["kind"], label: string, accept: string, detail: string) {
    return (
      <label
        className={styles.dropzone}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          // `dataTransfer.files` only stays valid for the synchronous span of this event; `upload`
          // is async (its first step, `persist()`, alone takes 3s+ per the real save logs) and
          // reads the list only after that await. Materialize it into a plain array NOW, not a
          // live reference read later.
          if (!busy) void upload(Array.from(e.dataTransfer.files), kind);
        }}
      >
        <b>＋ {label}</b>
        <small>{detail}</small>
        <input
          type="file"
          multiple
          accept={accept}
          disabled={busy || (kind === "documents" && !config)}
          onChange={(e) => {
            // Same reasoning as onDrop above: `input.files` is a LIVE FileList tied to the input's
            // current value. Resetting `e.target.value` below (needed so re-picking the same file
            // fires another change event) clears `.files` too — including for any code still
            // holding this same reference. Snapshot into a plain array before that reset, or the
            // upload silently receives zero files once `persist()`'s await resolves.
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length > 0) void upload(files, kind);
          }}
        />
      </label>
    );
  }
  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb}>
        <Link href="/listings">Listings</Link>
        <span>›</span>
        {listingId ? "Edit Listing" : "Tambah Listing"}
      </nav>
      <header className={styles.header}>
        <div>
          <h1>{listingId ? "Edit Listing" : "Tambah Listing"}</h1>
          <p>Lengkapi informasi properti, media, dan knowledge untuk Samantha.</p>
          {workspace && (
            <p>
              Workspace: {workspace.tenantId} · {workspace.vertical} · {workspace.email}
            </p>
          )}
          {workspace && workspace.vertical !== "PROPERTY" && (
            <p>
              Gunakan akun owner workspace properti untuk menyimpan listing.{" "}
              <Link href="/login?redirectedFrom=/listings/new">Masuk dengan akun properti</Link>
            </p>
          )}
        </div>
        <div className={styles.actions}>
          <button disabled={busy} onClick={() => void action("draft")}>
            ▣ Simpan Draft
          </button>
          <button
            disabled={busy || !form.title || !Number(form.price)}
            onClick={() => void action("analyze")}
          >
            ✧ Analisa dengan Samantha
          </button>
          <button className={styles.primary} disabled={busy} onClick={() => void action("save")}>
            Simpan Listing
          </button>
        </div>
      </header>
      <div className={styles.progress}>
        {[
          "Informasi Dasar",
          "Media Assets",
          "Dokumen Knowledge",
          "Samantha Strategy",
          "Review",
        ].map((name, i) => (
          <button
            key={name}
            data-active={step === i}
            onClick={() => {
              setStep(i);
              document
                .getElementById(["basic", "media", "knowledge", "strategy", "review"][i] ?? "basic")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <span>{i + 1}</span>
            {name}
          </button>
        ))}
      </div>
      <div role="status" className={styles.notice}>
        {busy ? "Memproses… " : ""}
        {message}
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.columns}>
        <section className={styles.stack}>
          <article id="basic" className={styles.card}>
            <h2>⌂ Informasi Dasar</h2>
            <p>Informasi utama properti yang akan dipasarkan.</p>
            <div className={styles.form}>
              {field("title", "Judul Listing *", undefined, true)}
              {field("propertyType", "Jenis Properti *", [
                "RUMAH",
                "APARTEMEN",
                "RUKO",
                "TANAH",
                "VILLA",
              ])}
              {field("price", "Harga (Rp) *")}
              {field("description", "Deskripsi Singkat", undefined, true)}
            </div>
          </article>
          <article className={styles.card}>
            <h2>▤ Detail Properti</h2>
            <p>Spesifikasi mengikuti jenis properti.</p>
            <div className={styles.form}>
              {type !== "APARTEMEN" && field("landArea", "Luas Tanah (m²)")}
              {type !== "TANAH" && field("buildArea", "Luas Bangunan (m²)")}
              {type !== "TANAH" && field("bedrooms", "Kamar Tidur")}
              {type !== "TANAH" && field("bathrooms", "Kamar Mandi")}
              {type !== "TANAH" && field("floors", "Jumlah Lantai")}
              {field("certificate", "Sertifikat", [
                "SHM",
                "HGB",
                "SHGB",
                "STRATA TITLE",
                "LAINNYA",
              ])}
              {field("condition", "Kondisi", ["Baru", "Bekas", "Dalam pembangunan"])}
            </div>
          </article>
          <article className={styles.card}>
            <h2>⌖ Lokasi</h2>
            <p>Gunakan alamat dan wilayah properti yang sebenarnya.</p>
            <div className={styles.form}>
              {field("address", "Alamat Lengkap *", undefined, true)}
              {field("city", "Kota *")}
              {field("province", "Provinsi")}
              {field("kecamatan", "Kecamatan")}
              {field("postalCode", "Kode Pos")}
            </div>
          </article>
          <article className={styles.card}>
            <h2>♧ Kontak & Tujuan Lead</h2>
            <MetaLeadDestination
              pageId={form.metaPageId ?? ""}
              number={form.waNumber ?? ""}
              onChange={(page, account, number) => {
                change("metaPageId", page);
                change("metaAdAccountId", account);
                change("waNumber", number);
              }}
            />
          </article>
        </section>
        <section className={styles.stack} id="media">
          <article className={styles.card}>
            <h2>▧ Media & Knowledge</h2>
            <p>Foto, video, dan dokumen pendukung listing.</p>
            <h3>
              Foto Listing <small>{photos.length} foto</small>
            </h3>
            <div className={styles.photos}>
              {photos.map((photo) => (
                <figure key={photo.id}>
                  <img src={photo.url} alt={form.title || "Foto listing"} />
                  <button
                    className={styles.remove}
                    aria-label="Hapus foto"
                    disabled={busy}
                    onClick={() =>
                      void mediaAction("listings/" + id.current + "/photos/" + photo.id, "DELETE")
                    }
                  >
                    ×
                  </button>
                  <button
                    className={styles.mainPhoto}
                    disabled={busy || photo.isMain}
                    onClick={() =>
                      void mediaAction("listings/" + id.current + "/photos/reorder", "PUT", {
                        photoIds: photos.map((p) => p.id),
                        mainPhotoId: photo.id,
                      })
                    }
                  >
                    {photo.isMain ? "★ Utama" : "Jadikan utama"}
                  </button>
                </figure>
              ))}
            </div>
            {dropzone(
              "photos",
              "Upload Foto",
              "image/jpeg,image/png,image/webp",
              "Beberapa foto · maksimal 10 MB/foto",
            )}
          </article>
          <article className={styles.card}>
            <h3>
              ▷ Video Materi <small>{videos.length} video</small>
            </h3>
            <div className={styles.videos}>
              {videos.map((video) => (
                <div key={video.id}>
                  {video.url ? (
                    <video src={video.url} controls preload="metadata" />
                  ) : (
                    <p>Video tersimpan · preview belum tersedia</p>
                  )}
                  <small>{video.fileName}</small>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void mediaAction(
                        "listing-knowledge/" + id.current + "/videos/" + video.id,
                        "DELETE",
                      )
                    }
                  >
                    Hapus
                  </button>
                </div>
              ))}
            </div>
            {dropzone(
              "videos",
              "Upload Video",
              "video/mp4,video/quicktime,video/webm",
              "MP4, MOV, WebM · maksimal 100 MB/video",
            )}
          </article>
          <article className={styles.card} id="knowledge">
            <h3>▤ Dokumen Knowledge</h3>
            <p>Potongan relevan akan dicari bersama lokasi sumbernya.</p>
            {knowledgeError && <p className={styles.error}>{knowledgeError}</p>}
            <div className={styles.documents}>
              {docs.map((doc) => (
                <div key={doc.id}>
                  <b>▤ {doc.file_name}</b>
                  <small>
                    {(doc.size_bytes / 1024 / 1024).toFixed(1)} MB · {doc.status}
                  </small>
                  {doc.error_code && (
                    <small className={styles.error}>
                      {doc.error_code === "OCR_REQUIRED"
                        ? "PDF scan memerlukan OCR yang belum tersedia."
                        : doc.error_code}
                    </small>
                  )}
                  <div>
                    {["FAILED", "OCR_REQUIRED"].includes(doc.status) && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void mediaAction(
                            "listing-knowledge/" + id.current + "/" + doc.id + "/retry",
                            "POST",
                          )
                        }
                      >
                        Proses ulang
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() =>
                        void mediaAction("listing-knowledge/" + id.current + "/" + doc.id, "DELETE")
                      }
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {dropzone(
              "documents",
              "Upload Dokumen",
              config?.formats.join(",") ?? "",
              config
                ? config.formats.join(", ") + " · maksimal " + config.maxBytes / 1024 / 1024 + " MB"
                : "Memuat format yang didukung…",
            )}
            <small>
              Dokumen tersimpan tidak otomatis berarti informasi promo telah diverifikasi.
            </small>
          </article>
          {uploads.length > 0 && (
            <article className={styles.card}>
              <h3>Upload</h3>
              {uploads.map((task, i) => (
                <div className={styles.upload} key={i}>
                  <small>{task.file.name}</small>
                  <progress value={task.progress} max={100} />
                  <small>{task.done ? "Tersimpan" : task.error || task.progress + "%"}</small>
                  {task.error && !task.done && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (id.current) {
                          setBusy(true);
                          void sendUpload(task, id.current).finally(() => setBusy(false));
                        }
                      }}
                    >
                      Coba lagi
                    </button>
                  )}
                </div>
              ))}
            </article>
          )}
          <p className={styles.storage}>♧ File disimpan di Google Cloud Storage.</p>
        </section>
        <aside className={styles.intelligence} id="strategy">
          <header>
            <span className={styles.avatar}>S</span>
            <div>
              <h2>✧ Samantha Listing Intelligence</h2>
              <p>Analisis fakta dan knowledge listing Anda.</p>
            </div>
          </header>
          <article className={styles.card}>
            <h3>Listing Readiness</h3>
            <div className={styles.readiness}>
              <div
                style={{
                  background: "conic-gradient(var(--success) " + ready + "%, var(--border) 0)",
                }}
              >
                <b>
                  {ready}
                  <small>/100</small>
                </b>
              </div>
              <p>
                {ready >= 80 ? "Informasi semakin lengkap" : "Lengkapi data listing"}
                <small>Kelengkapan input, bukan jaminan siap beriklan.</small>
              </p>
            </div>
          </article>
          <article className={styles.card}>
            <h3>Yang Akan Ditinjau</h3>
            <div className={styles.checks}>
              {checks.map(([label, done]) => (
                <span key={label} data-ready={done}>
                  {done ? "✓" : "○"} {label}
                </span>
              ))}
            </div>
            <p>
              {processing
                ? "Dokumen sedang diproses. Analisis hanya memakai dokumen berstatus READY."
                : "Samantha memakai fakta listing dan potongan knowledge yang relevan."}
            </p>
          </article>
          <article className={styles.card}>
            <h3>Preview Copy</h3>
            {analysis ? (
              <>
                <small>Draft listing & sumber · verifikasi sebelum digunakan</small>
                <dl>
                  <dt>Primary Text</dt>
                  <dd>{analysis.copy.primaryText}</dd>
                  <dt>Headline</dt>
                  <dd>{analysis.copy.headline}</dd>
                  <dt>CTA</dt>
                  <dd>{analysis.copy.cta || "Lengkapi tujuan lead"}</dd>
                </dl>
              </>
            ) : (
              <p>Simpan data dan jalankan analisis untuk menampilkan copy berbasis fakta.</p>
            )}
          </article>
          <article className={styles.card}>
            <h3>Rekomendasi Strategy</h3>
            {analysis?.analysisAvailable ? (
              <>
                <p>Usulan objective: Qualified Leads</p>
                <small>Area: {analysis.strategy?.location || "Lengkapi lokasi"}</small>
                {analysis.strategy?.angles.map((angle) => (
                  <p key={angle}>✧ {angle}</p>
                ))}
              </>
            ) : (
              <p>
                Rekomendasi muncul setelah analisis AI berhasil. Targeting dan struktur iklan tetap
                perlu ditinjau.
              </p>
            )}
          </article>
          <article className={styles.card}>
            <h3>Sumber Knowledge</h3>
            {analysis ? (
              <>
                <small>Pencarian: {analysis.retrievalMode}</small>
                {analysis.sources.length ? (
                  analysis.sources.map((source, i) => (
                    <details key={i}>
                      <summary>
                        {source.fileName}
                        {source.location.sheet ? " → Sheet " + source.location.sheet : ""}
                        {source.location.rowStart ? " → Row " + source.location.rowStart : ""}
                        {source.location.page ? " → Page " + source.location.page : ""}
                      </summary>
                      <p>{source.excerpt}</p>
                    </details>
                  ))
                ) : (
                  <p>Belum ada potongan relevan yang ditemukan.</p>
                )}
                {analysis.warnings.map((w) => (
                  <p className={styles.notice} key={w}>
                    {w}
                  </p>
                ))}
              </>
            ) : (
              <p>Contoh bentuk sumber: dokumen → sheet → baris, atau dokumen → halaman.</p>
            )}
          </article>
          <article className={styles.card} id="review">
            <h3>Review Sebelum Disimpan</h3>
            <p>
              Listing dapat disimpan ketika dokumen masih diproses. Kesiapan campaign diperiksa
              terpisah dari kelengkapan listing.
            </p>
            <small>{saved ? "ID: " + saved.id : "ID dibuat setelah draft pertama disimpan."}</small>
          </article>
        </aside>
      </div>
    </main>
  );
}
