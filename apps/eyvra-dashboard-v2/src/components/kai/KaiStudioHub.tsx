import Link from "next/link";
import type { KaiPackage } from "@/lib/kai-studio";
import { Asset } from "./KaiMediaInspector";
import { kaiViews, type KaiView } from "./KaiStudioNavigation";
import s from "./KaiStudioHub.module.css";

type Project = {
  id: string;
  briefId: string;
  title: string;
  objective: string;
  status: string;
  updatedAt: string;
};
export function KaiStudioHub({
  view,
  packages,
  projects,
  search,
  queueError,
  refresh,
}: {
  view: KaiView;
  packages: KaiPackage[];
  projects: Project[];
  search: string;
  queueError: boolean;
  refresh: () => void;
}) {
  const matches = (value: string) => value.toLowerCase().includes(search.toLowerCase());
  const visible = packages
    .filter((p) => matches(`${p.title} ${p.reason}`))
    .filter((p) => {
      const format = p.productionFormat ?? p.decidedFormat ?? p.requestedFormat ?? "";
      if (view === "image")
        return format === "IMAGES_ONLY" || format === "IMAGE" || format === "VIDEO_AND_IMAGES";
      if (view === "video") return format.includes("VIDEO") || !!p.videoUrl;
      // Multiple image files do not prove carousel narrative or format.
      if (view === "carousel") return format === "CAROUSEL";
      if (view === "qa")
        return ["PENDING", "PENDING_REVIEW", "REJECTED", "FAILED"].includes(p.status);
      if (view === "assets") return !!p.videoUrl || !!p.imageUrls?.length;
      return true;
    });
  const cards = visible.map((p) => (
    <Link
      className={s.card}
      key={p.id}
      href={`/kai-studio/${encodeURIComponent(p.briefId)}?concept=${encodeURIComponent(p.id)}`}
    >
      <Asset urls={[p.imageUrls?.[0], p.sourcePhotoUrls?.[0]]} name={p.title} />
      <div>
        <small>
          {p.productionFormat ?? p.decidedFormat ?? p.requestedFormat ?? "Format belum tercatat"} ·{" "}
          {p.status}
        </small>
        <h3>{p.title}</h3>
        <p>{p.reason || p.primaryMessage}</p>
        <span>Buka proyek →</span>
      </div>
    </Link>
  ));
  return (
    <section className={s.hub}>
      <header className={s.heading}>
        <div>
          <h2>{kaiViews.find(([key]) => key === view)?.[1]}</h2>
          <p>Image, video, dan carousel dalam satu alur produksi Kai.</p>
        </div>
        <button onClick={refresh}>Perbarui</button>
        <Link className={s.primary} href="/campaigns/new">
          + Brief dari campaign
        </Link>
      </header>
      {view === "overview" && (
        <>
          <div className={s.stats}>
            {[
              ["Proyek", queueError ? "—" : projects.length],
              ["Paket sedang dibuat", packages.filter((p) => p.status === "GENERATING").length],
              [
                "Menunggu review",
                packages.filter((p) => p.status === "PENDING" || p.status === "PENDING_REVIEW")
                  .length,
              ],
              ["Gagal", packages.filter((p) => p.status === "FAILED").length],
            ].map(([label, value]) => (
              <div key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <p className={s.note}>
            Ringkasan dari proyek dan maksimal 200 paket terbaru. Status paket belum berarti lulus
            QA, Simulation, atau siap publish.
          </p>
          <div className={s.formats}>
            {[
              ["image", "Image Studio", "Art direction, komposisi, copy, dan variasi rasio."],
              ["video", "Video Studio", "Script, storyboard, scene, dan komposisi video."],
              ["carousel", "Carousel Studio", "Alur cerita, peran slide, dan konsistensi visual."],
            ].map(([key, label, note]) => (
              <Link key={key} href={`/kai-studio?view=${key}`}>
                <h3>{label}</h3>
                <p>{note}</p>
                <span>Buka workspace →</span>
              </Link>
            ))}
          </div>
        </>
      )}
      {queueError && (
        <p role="alert">Daftar proyek belum dapat dimuat. Tekan Perbarui untuk mencoba kembali.</p>
      )}
      {(view === "overview" || view === "projects" || view === "queue") && (
        <div className={s.projects}>
          {projects
            .filter((p) => matches(`${p.title} ${p.objective}`))
            .map((p) => (
              <Link key={p.id} href={`/kai-studio/${p.briefId}?project=${p.id}`}>
                <div>
                  <small>{p.status}</small>
                  <h3>{p.title}</h3>
                  <p>{p.objective}</p>
                </div>
                <span>Buka produksi →</span>
              </Link>
            ))}
        </div>
      )}
      {view === "settings" ? (
        <div className={s.notice}>
          <h3>Pengaturan produksi mengikuti Growth Settings</h3>
          <p>
            Atur format image, video, carousel, target kualitas, eksplorasi, serta gate QA dan
            Simulation dari kebijakan workspace.
          </p>
          <Link href="/automation/growth-settings">Buka Creative & Content →</Link>
          <p>Pengaturan biaya per proyek, voice, musik, dan revisi otomatis belum tersedia.</p>
        </div>
      ) : view === "reference" ? (
        <div className={s.notice}>
          <h3>Reference Intelligence belum terhubung</h3>
          <p>
            Analisis hook, pacing, struktur scene, dan CTA dari video referensi belum tersedia. Foto
            listing yang digunakan dalam proyek tetap menjadi sumber fakta; referensi gaya tidak
            menggantikannya.
          </p>
          <Link href="/kai-studio?view=assets">Lihat aset produksi →</Link>
        </div>
      ) : (
        <>
          <div className={s.cards}>{cards}</div>
          {cards.length === 0 && (
            <div className={s.notice}>
              <h3>Belum ada paket untuk tampilan ini</h3>
              <p>
                Buka Creative Projects untuk merencanakan format dari brief Samantha. Paket lama
                tanpa metadata format tidak otomatis dianggap carousel.
              </p>
              <Link href="/kai-studio?view=projects">Buka Creative Projects →</Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
