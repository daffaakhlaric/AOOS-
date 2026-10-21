"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Drawer } from "@/components/common/Drawer";
import {
  MODE_LABELS,
  PRIMARY_GOAL_LABELS,
  SCORE_BUCKET_LABELS,
  STATUS_LABELS,
  type StressTestRunDto,
} from "@/lib/stress-test";
import type { SimulationComparison } from "@/lib/simulation-compare";
import { buildRunAgainHref, evaluatedResultOf } from "@/lib/stress-test-result";
import { useRunContext } from "../result/useRunContext";
import { SendToKaiPanel } from "../result/SendToKaiPanel";
import styles from "./compare.module.css";

const date = (s: string) =>
  new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
const signed = (n: number | null | undefined) => (n == null ? "N/A" : `${n > 0 ? "+" : ""}${n}`);
function Delta({ value, lower = false }: { value: number | null | undefined; lower?: boolean }) {
  return (
    <span
      className={
        value == null || value === 0
          ? styles.neutral
          : (lower ? value < 0 : value > 0)
            ? styles.good
            : styles.bad
      }
    >
      {signed(value)}
    </span>
  );
}
function Score({ value }: { value: number | null }) {
  return (
    <span className={styles.scoreBar}>
      {value == null ? (
        "N/A"
      ) : (
        <>
          <progress max={100} value={value} />
          {value}
        </>
      )}
    </span>
  );
}
function RunCreativeCard({ run, index }: { run: StressTestRunDto; index: number }) {
  const context = useRunContext(run);
  const result = evaluatedResultOf(run);
  const media =
    context.creativeInfo.creatives.find((c) => c.evaluated) ?? context.creativeInfo.creatives[0];
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [media?.thumbnailUrl]);
  const bucket = result?.scoreBucket;
  return (
    <div className={styles.runColumn}>
      <section className={styles.card}>
        <header>
          <span className={styles.runBadge}>Run #{index}</span>
          <h2>{index === 1 ? "Creative Acuan" : "Creative Pembanding"}</h2>
          <span className={styles.status} data-state={bucket ?? "UNKNOWN"}>
            {bucket ? SCORE_BUCKET_LABELS[bucket] : STATUS_LABELS[run.status]}
          </span>
        </header>
        <b>{run.name}</b>
        <small>{date(run.createdAt)}</small>
        <div className={styles.creative}>
          <div className={styles.preview}>
            {media?.thumbnailUrl && !failed ? (
              <img
                src={media.thumbnailUrl}
                alt={`Creative ${run.name}`}
                onError={() => setFailed(true)}
              />
            ) : (
              <span>
                ▧<small>{context.loading ? "Memuat creative…" : "Preview belum tersedia"}</small>
              </span>
            )}
          </div>
          <div>
            <h3>{media?.headline ?? media?.title ?? "Creative terpilih"}</h3>
            <small className={styles.id}>{media?.id ?? run.creativeIds.join(", ")}</small>
            <span className={styles.chip}>{media?.format ?? "Format belum tersedia"}</span>
            {media?.angle && <span className={styles.chip}>{media.angle}</span>}
            <p>
              {context.listing?.title ??
                (run.campaignId ? "Campaign terkait" : "Konteks run tersimpan")}
            </p>
            {context.listingId && (
              <Link
                className={styles.chip}
                href={`/listings/${encodeURIComponent(context.listingId)}`}
              >
                ⌂ Listing
              </Link>
            )}
            <Link
              className={styles.textLink}
              href={`/samantha/stress-test/${encodeURIComponent(run.id)}`}
            >
              Lihat hasil run →
            </Link>
          </div>
        </div>
        <small>
          Preview dari aset saat ini; snapshot visual saat run belum tersimpan. Hubungan revisi Kai
          belum terverifikasi.
        </small>
      </section>
      <div className={styles.scoreCards}>
        <section className={styles.card}>
          <h3>Creative Readiness Score</h3>
          <div className={styles.readiness}>
            <div
              className={styles.ring}
              style={{
                background: `conic-gradient(${bucket === "MAJOR_ISSUES" ? "var(--critical)" : "var(--success)"} ${(result?.overallScore ?? 0) * 3.6}deg, var(--border) 0)`,
              }}
            >
              <div>
                <b>{result?.overallScore ?? "N/A"}</b>
                <small>/100</small>
              </div>
            </div>
            <div>
              <span className={styles.status} data-state={bucket ?? "UNKNOWN"}>
                {bucket ? SCORE_BUCKET_LABELS[bucket] : "Belum dinilai"}
              </span>
              <p>Kesiapan creative dari simulasi, bukan prediksi performa Meta.</p>
            </div>
          </div>
        </section>
        <section className={styles.card}>
          <h3>Confidence</h3>
          <strong className={styles.confidence}>{result ? `${result.confidence}%` : "N/A"}</strong>
          {result && (
            <progress className={styles.confidenceTrack} value={result.confidence} max={100} />
          )}
          <small>
            Evaluator:{" "}
            {result ? `${result.evaluatorsSucceeded}/${result.evaluatorsAttempted}` : "N/A"}{" "}
            berhasil. Bukan probabilitas keberhasilan iklan.
          </small>
          <details>
            <summary>Cakupan & grounding</summary>
            <p>{result?.factCheck.note ?? "Fact grounding belum tersedia."}</p>
            <p>Sumber yang dipilih: {run.objectionSources.join(", ") || "Tidak ada"}.</p>
            {result?.gaps.map((gap) => (
              <p key={gap}>{gap}</p>
            ))}
          </details>
        </section>
      </div>
    </div>
  );
}

export function CompareSimulationRunsPage() {
  const router = useRouter(),
    query = useSearchParams();
  const runA = query.get("runA") ?? "",
    runB = query.get("runB") ?? "";
  const [runs, setRuns] = useState<StressTestRunDto[]>();
  const [listError, setListError] = useState("");
  const [comparison, setComparison] = useState<SimulationComparison>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selectOpen, setSelectOpen] = useState(false);
  const [choiceA, setChoiceA] = useState(runA),
    [choiceB, setChoiceB] = useState(runB);
  const [detail, setDetail] = useState<{ title: string; content: React.ReactNode }>();
  const [kai, setKai] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setListError("");
    fetch("/api/creative-stress-test", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<{ runs: StressTestRunDto[] }>;
      })
      .then((body) => {
        if (!controller.signal.aborted) setRuns(body.runs);
      })
      .catch(() => {
        if (!controller.signal.aborted) setListError("Riwayat run gagal dimuat.");
      });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    const controller = new AbortController();
    setComparison(undefined);
    setError("");
    setChoiceA(runA);
    setChoiceB(runB);
    if (runA && runB)
      fetch(`/api/creative-stress-test/compare?${new URLSearchParams({ runA, runB })}`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok) throw new Error(body.message ?? "Perbandingan gagal dimuat.");
          return body as SimulationComparison;
        })
        .then((body) => {
          if (!controller.signal.aborted) setComparison(body);
        })
        .catch((e: unknown) => {
          if (!controller.signal.aborted)
            setError(e instanceof Error ? e.message : "Perbandingan gagal dimuat.");
        });
    return () => controller.abort();
  }, [runA, runB, retry]);
  function select() {
    setChoiceA(runA);
    setChoiceB(runB);
    setSelectOpen(true);
  }
  const bResult = comparison && evaluatedResultOf(comparison.runB);
  function evidence(index: number) {
    const row = comparison?.dimensions[index];
    if (!row) return;
    setDetail({
      title: row.label,
      content: (
        <>
          <p>
            Run A: {row.scoreA ?? "N/A"} → Run B: {row.scoreB ?? "N/A"}. Selisih:{" "}
            {signed(row.delta)}.
          </p>
          {[row.evidenceA, row.evidenceB].map((e, i) => (
            <section key={i}>
              <h3>Run {i === 0 ? "A" : "B"} · bukti evaluator</h3>
              <p>{e?.copyReasoning?.reasoning ?? "Tidak ada evaluasi copy untuk dimensi ini."}</p>
              {e?.objections.map((o, j) => (
                <p key={j}>
                  {o.personaLabel}: {o.objection}
                </p>
              ))}
            </section>
          ))}
          <p>
            Perbedaan skor belum membuktikan hasil Meta. Tinjau perubahan konteks sebelum mengambil
            tindakan.
          </p>
        </>
      ),
    });
  }
  return (
    <main className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href="/samantha/stress-test">Simulation Lab</Link> › <span>Compare Runs</span>
      </div>
      <header className={styles.heading}>
        <div>
          <h1>Bandingkan Hasil Simulasi</h1>
          <p>
            Lihat perubahan skor, keberatan pembeli, dan rekomendasi sebelum melanjutkan revisi
            creative.
          </p>
        </div>
        <div className={styles.actions}>
          <button onClick={select}>Pilih Run ({Number(!!runA) + Number(!!runB)})⌄</button>
          <button className={styles.primary} onClick={select}>
            ＋ Bandingkan Run
          </button>
        </div>
      </header>
      <nav className={styles.localNav} aria-label="Simulation Lab">
        <Link href="/samantha/stress-test/run">Buat Simulasi</Link>
        <Link href="/samantha/stress-test">Riwayat Simulasi</Link>
        <span aria-current="page">Compare Runs</span>
        {runB && (
          <Link href={`/samantha/stress-test/${encodeURIComponent(runB)}#objection-intelligence`}>
            Objection Intelligence
          </Link>
        )}
      </nav>
      {query.get("runC") && (
        <p className={styles.warning}>
          Saat ini tampilan membandingkan dua run. Run C belum disertakan.
        </p>
      )}
      {listError && (
        <p role="alert" className={styles.warning}>
          {listError} <button onClick={() => setRetry((n) => n + 1)}>Coba lagi</button>
        </p>
      )}
      {error ? (
        <section className={styles.empty} role="alert">
          <h2>Perbandingan belum tersedia</h2>
          <p>{error}</p>
          <button onClick={() => setRetry((n) => n + 1)}>Coba lagi</button>
          <button onClick={select}>Pilih run lain</button>
        </section>
      ) : !runA || !runB ? (
        <section className={styles.empty}>
          <h2>
            {runs && runs.length < 2
              ? "Belum ada run pembanding"
              : "Pilih dua run untuk dibandingkan"}
          </h2>
          <p>Bandingkan minimal 2 run dari listing, campaign, atau creative yang sama.</p>
          <button onClick={select}>Pilih Run A & Run B</button>
          <Link href={runA ? buildRunAgainHref(runA, "rerun") : "/samantha/stress-test/run"}>
            Run Simulasi Lagi →
          </Link>
        </section>
      ) : !comparison ? (
        <div aria-busy="true" aria-label="Memuat perbandingan" className={styles.loading}>
          <p>Memuat run dan membandingkan hasil…</p>
          <div />
          <div />
        </div>
      ) : (
        <>
          <details className={styles.fairness} open={comparison.comparability.blocked}>
            <summary>
              <b>
                {comparison.comparability.blocked
                  ? "Tidak dapat dibandingkan langsung"
                  : "Sebagian sebanding"}
              </b>{" "}
              · Lihat konteks dan batas perbandingan
            </summary>
            <ul>
              {comparison.comparability.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <p>
              Run A: {MODE_LABELS[comparison.runA.mode]} ·{" "}
              {PRIMARY_GOAL_LABELS[comparison.runA.primaryGoal]} | Run B:{" "}
              {MODE_LABELS[comparison.runB.mode]} ·{" "}
              {PRIMARY_GOAL_LABELS[comparison.runB.primaryGoal]}
            </p>
            <p>
              Lineage revisi belum tercatat. Selisih tidak boleh dianggap murni akibat revisi
              creative.
            </p>
          </details>
          <div className={styles.layout}>
            <div className={styles.main}>
              <div className={styles.runPair}>
                <RunCreativeCard key={comparison.runA.id + "a"} run={comparison.runA} index={1} />
                <RunCreativeCard key={comparison.runB.id + "b"} run={comparison.runB} index={2} />
              </div>
              <div className={styles.tables}>
                <section className={styles.card}>
                  <h2>Perbandingan Skor per Dimensi</h2>
                  <div className={styles.tableWrap}>
                    <table>
                      <thead>
                        <tr>
                          <th>Dimensi</th>
                          <th>Run #1</th>
                          <th>Run #2</th>
                          <th>Perubahan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparison.dimensions.map((d, i) => (
                          <tr key={d.label}>
                            <td data-label="Dimensi">
                              <button className={styles.textButton} onClick={() => evidence(i)}>
                                {d.label}
                              </button>
                            </td>
                            <td data-label="Run #1">
                              <Score value={d.scoreA} />
                            </td>
                            <td data-label="Run #2">
                              <Score value={d.scoreB} />
                            </td>
                            <td data-label="Perubahan">
                              <Delta value={d.delta} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <small>N/A: skor tidak tersedia atau konteks tidak mendukung delta.</small>
                </section>
                <section className={styles.card}>
                  <h2>Ringkasan Keberatan Pembeli</h2>
                  <div className={styles.tableWrap}>
                    <table>
                      <thead>
                        <tr>
                          <th>Metrik</th>
                          <th>#1</th>
                          <th>#2</th>
                          <th>Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          [
                            ["total", "Total unik teramati"],
                            ["unresolved", "Belum terjawab"],
                            ["partial", "Sebagian terjawab"],
                            ["resolved", "Terjawab"],
                            ["other", "Butuh penanganan lain"],
                          ] as const
                        ).map(([key, label]) => (
                          <tr key={key}>
                            <td data-label="Metrik">{label}</td>
                            <td data-label="Run #1">{comparison.summaryA[key] ?? "N/A"}</td>
                            <td data-label="Run #2">{comparison.summaryB[key] ?? "N/A"}</td>
                            <td data-label="Perubahan">
                              {key === "total" || key === "partial" || key === "other" ? (
                                signed(comparison.summaryDeltas[key])
                              ) : (
                                <Delta
                                  value={comparison.summaryDeltas[key]}
                                  lower={key === "unresolved"}
                                />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <small>
                    Resolusi hanya dari evaluator yang menilai. Total unik teramati tidak selalu
                    sama dengan jumlah yang dinilai resolusinya.
                  </small>
                  <div className={styles.changes}>
                    <h3>Perubahan Teramati</h3>
                    {comparison.improvements.slice(0, 2).map((d) => (
                      <p key={d.label} className={styles.good}>
                        ↗ {d.label} {signed(d.delta)}
                      </p>
                    ))}
                    {comparison.regressions.map((d) => (
                      <p key={d.label} className={styles.bad}>
                        ↘ {d.label} {signed(d.delta)}
                      </p>
                    ))}
                    {!comparison.improvements.length && !comparison.regressions.length && (
                      <p>Belum ada perubahan dimensi yang dapat dihitung.</p>
                    )}
                  </div>
                </section>
              </div>
              <section className={styles.card}>
                <h2>Top 5 Keberatan Sebelum vs Sesudah</h2>
                <p className={styles.note}>
                  Simulation Agreement dari persona AI, bukan frekuensi pembeli nyata. Pencocokan
                  memakai teks identik yang dinormalisasi; tidak muncul kembali bukan berarti
                  terjawab.
                </p>
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Keberatan pembeli</th>
                        <th>Run #1</th>
                        <th>Run #2</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.objections.slice(0, 5).map((o) => (
                        <tr key={o.key}>
                          <td data-label="Keberatan">
                            <button
                              className={styles.textButton}
                              onClick={() =>
                                setDetail({
                                  title: o.text,
                                  content: (
                                    <>
                                      {[o.a, o.b].map((v, i) => (
                                        <section key={i}>
                                          <h3>Run {i + 1} · simulasi persona</h3>
                                          <p>
                                            {v
                                              ? `${v.personaCount}/${v.personasSimulated} persona`
                                              : "Tidak teramati; resolusi belum dapat disimpulkan."}
                                          </p>
                                          {v?.personas.map((p, j) => (
                                            <p key={j}>
                                              {p.personaLabel} · {p.severity}
                                            </p>
                                          ))}
                                        </section>
                                      ))}
                                      <h3>Bukti resolusi Run B</h3>
                                      <p>{o.resolutionB?.evidence ?? "Belum tersedia."}</p>
                                      <p>{o.resolutionB?.shortRecommendation}</p>
                                    </>
                                  ),
                                })
                              }
                            >
                              {o.text}
                            </button>
                          </td>
                          <td data-label="Run #1">
                            {o.a
                              ? `${o.a.personaCount}/${o.a.personasSimulated} persona`
                              : "Tidak teramati"}
                          </td>
                          <td data-label="Run #2">
                            {o.b
                              ? `${o.b.personaCount}/${o.b.personasSimulated} persona`
                              : "Tidak teramati"}
                          </td>
                          <td data-label="Status">{o.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!comparison.objections.length && (
                  <p>Belum ada keberatan simulasi yang dapat ditampilkan.</p>
                )}
              </section>
              <section className={styles.card}>
                <h2>Fact Grounding & Cakupan Bukti</h2>
                <div className={styles.factPair}>
                  {[comparison.factsA, comparison.factsB].map((f, i) => (
                    <div key={i}>
                      <h3>Run #{i + 1}</h3>
                      <p>
                        {f
                          ? `${f.verified} didukung · ${f.unsupported} tidak didukung · ${f.conflicting} bertentangan`
                          : "Fact validation tidak tersedia."}
                      </p>
                    </div>
                  ))}
                </div>
                {comparison.newClaimRisks.map((f, i) => (
                  <p key={i} className={styles.bad}>
                    ⚠ Klaim berisiko baru/perubahan status: {f.claim} — {f.reasoning}
                  </p>
                ))}
                <small>
                  Cakupan listing, knowledge, Meta, dan Respon Pintar saat run tidak seluruhnya
                  tersimpan sebagai snapshot. Lihat detail confidence masing-masing run.
                </small>
              </section>
            </div>
            <aside className={styles.rail}>
              <section className={`${styles.card} ${styles.tinted}`}>
                <h2>▣ Perubahan Utama</h2>
                <p>Selisih Run #2 terhadap Run #1 berdasarkan hasil tersimpan.</p>
                <div className={styles.deltaLine}>
                  <Delta value={comparison.overallDelta} />
                  <span>Skor keseluruhan</span>
                </div>
                <div className={styles.deltaLine}>
                  <Delta value={comparison.summaryDeltas.unresolved} lower />
                  <span>Keberatan belum terjawab</span>
                </div>
                {comparison.dimensions
                  .filter((d) => ["Hook & Attention", "CTA"].includes(d.label))
                  .map((d) => (
                    <div className={styles.deltaLine} key={d.label}>
                      <Delta value={d.delta} />
                      <span>{d.label}</span>
                    </div>
                  ))}
                {comparison.regressions.length > 0 && (
                  <div className={styles.regression}>
                    <b>Regresi terdeteksi</b>
                    {comparison.regressions.map((d) => (
                      <p key={d.label}>
                        {d.label}: {d.scoreA} → {d.scoreB} ({signed(d.delta)})
                      </p>
                    ))}
                  </div>
                )}
              </section>
              <section className={styles.card}>
                <h2>Delta Skor Keseluruhan</h2>
                <strong className={styles.bigDelta}>
                  <Delta value={comparison.overallDelta} />
                </strong>
                <span>
                  {evaluatedResultOf(comparison.runA)?.overallScore ?? "N/A"} →{" "}
                  {bResult?.overallScore ?? "N/A"}
                </span>
              </section>
              <section className={`${styles.card} ${styles.tinted}`}>
                <h2>✧ Samantha Insight</h2>
                <p>{comparison.insight}</p>
                <details>
                  <summary>Rekomendasi tersimpan Run #2</summary>
                  <p>{bResult?.primaryRecommendation ?? "Belum ada rekomendasi."}</p>
                </details>
                <small>Ringkasan perbedaan, belum merupakan keputusan penerimaan otomatis.</small>
              </section>
              <section className={styles.card}>
                <h2>ϟ Aksi Selanjutnya</h2>
                <div className={styles.nextActions}>
                  <button
                    className={styles.primary}
                    disabled={!bResult || comparison.comparability.blocked}
                    onClick={() => setKai(true)}
                  >
                    ✧ Kirim Revisi Lagi ke Kai
                  </button>
                  <Link href={buildRunAgainHref(comparison.runB.id, "rerun")}>
                    ▷ Run Simulasi Lagi
                  </Link>
                  <button disabled title="Handoff eksperimen dari perbandingan belum tersedia.">
                    ♙ Buat Draft Eksperimen
                  </button>
                  <Link href="/kai-studio">Open Kai Creative →</Link>
                </div>
                <small>
                  Run lagi membuka pengaturan Run #2 untuk ditinjau. Draft eksperimen dan penerimaan
                  versi belum tersedia.
                </small>
              </section>
            </aside>
          </div>
        </>
      )}
      <Drawer
        open={selectOpen}
        onClose={() => setSelectOpen(false)}
        title="Pilih Run untuk Perbandingan"
      >
        <p>
          Pilih dua run dengan konteks yang sama. Setiap hasil tetap disimpan sebagai versi
          terpisah.
        </p>
        {runs === undefined ? (
          <p>{listError || "Memuat run…"}</p>
        ) : (
          <>
            <div className={styles.selector}>
              {[
                ["Run A", choiceA, setChoiceA],
                ["Run B", choiceB, setChoiceB],
              ].map(([label, value, setter]) => (
                <label key={String(label)}>
                  {String(label)}
                  <select
                    value={String(value)}
                    onChange={(e) => (setter as (s: string) => void)(e.target.value)}
                  >
                    <option value="">Pilih run</option>
                    {runs.map((run) => (
                      <option
                        key={run.id}
                        value={run.id}
                        disabled={label === "Run B" && run.id === choiceA}
                      >
                        {run.name} · {date(run.createdAt)} · {MODE_LABELS[run.mode]} ·{" "}
                        {evaluatedResultOf(run)?.overallScore ?? "N/A"}/100 ·{" "}
                        {STATUS_LABELS[run.status]}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <button
              className={styles.primary}
              disabled={!choiceA || !choiceB || choiceA === choiceB}
              onClick={() => {
                router.replace(
                  `/samantha/simulation/compare?${new URLSearchParams({ runA: choiceA, runB: choiceB })}`,
                );
                setSelectOpen(false);
              }}
            >
              Bandingkan Run
            </button>
            {runs.length < 2 && (
              <p>Belum ada run pembanding. Jalankan simulasi kedua terlebih dahulu.</p>
            )}
          </>
        )}
      </Drawer>
      <Drawer
        open={!!detail}
        onClose={() => setDetail(undefined)}
        title={detail?.title ?? "Detail perbandingan"}
      >
        {detail?.content}
      </Drawer>
      <Drawer open={kai} onClose={() => setKai(false)} title="Tinjau Revisi Run #2 untuk Kai">
        <p>
          Brief di bawah memakai hasil Run #2. Tinjau regresi dan bagian yang membaik sebelum
          mengirim; brief delta otomatis dan hubungan versi belum tersedia.
        </p>
        {comparison && bResult && <SendToKaiPanel run={comparison.runB} result={bResult} />}
      </Drawer>
    </main>
  );
}
