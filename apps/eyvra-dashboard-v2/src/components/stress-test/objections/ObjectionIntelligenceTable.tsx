"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/common/Card";
import {
  OBJECTION_SEVERITY_LABELS,
  type StressTestEvaluatedResultDto,
  type StressTestRunDto,
} from "@/lib/stress-test";
import {
  AI_ESTIMATE_LABEL,
  DEFAULT_OBJECTION_FILTERS,
  GOAL_IMPACT_TONE,
  OBJECTION_CATEGORY_TONE,
  OBJECTION_SORT_LABELS,
  RESOLUTION_TONE,
  filterObjectionRows,
  goalShortLabel,
  mapObjectionDetail,
  mapObjectionFilters,
  mapObjectionRows,
  objectionsCsvFilename,
  objectionsToCsv,
  type ObjectionCategory,
  type ObjectionFilterState,
  type ObjectionSort,
} from "@/lib/stress-test-objections";
import type { StressTestObjectionSeverity } from "@/lib/stress-test";
import { SimulationPersonaStack } from "../history/SimulationPersonaStack";
import { EvidenceBadge } from "../result/EvidenceBadge";
import { ObjectionDetailDrawer } from "./ObjectionDetailDrawer";
import styles from "./objections.module.css";

export const FREQUENCY_TOOLTIP =
  "x% persona simulasi memunculkan keberatan ini. Ini bukan frekuensi pembeli nyata.";
/** Legacy runs (no Objection Resolution evaluator output). */
export const IMPACT_TOOLTIP = "Belum dinilai — evaluator dampak belum tersedia";
export const IMPACT_AI_TOOLTIP =
  "Estimasi AI (simulasi) — penilaian AI atas seberapa besar keberatan ini menghambat tujuan utama. Bukan data terukur.";
export const RESOLUTION_AI_TOOLTIP =
  'Penilaian AI (simulasi) apakah teks creative sudah menjawab keberatan ini. "Sudah/Sebagian Terjawab" hanya bila kutipannya benar-benar ada di creative (diverifikasi server).';

function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * "Tabel Simulasi Keberatan Pembeli" — real simulated objections grouped by exact normalized text.
 * Frequency = share of successfully simulated personas (simulation agreement, not buyer frequency).
 * Category is an automatic keyword classification. Resolution status / impact / recommendation come
 * from the Objection Resolution evaluator (AI assessment, labelled as such); runs without it show
 * "—" / "Belum dinilai". Anchor: `#objections`.
 */
export function ObjectionIntelligenceTable({
  run,
  result,
}: {
  readonly run: StressTestRunDto;
  readonly result: StressTestEvaluatedResultDto;
}): React.ReactElement {
  const data = useMemo(() => mapObjectionRows(result), [result]);
  const options = useMemo(() => mapObjectionFilters(data.rows), [data.rows]);
  const [filters, setFilters] = useState<ObjectionFilterState>(DEFAULT_OBJECTION_FILTERS);
  const [detailKey, setDetailKey] = useState<string | undefined>();
  const rows = useMemo(() => filterObjectionRows(data.rows, filters), [data.rows, filters]);
  const goalLabel = goalShortLabel(run.primaryGoal);
  const assessed = !options.resolutionNotAssessed;
  const anchor = useRef<HTMLDivElement>(null);

  // Deep link from the Simulation Runs table (`#objections`): the section mounts after the run
  // loads, so the browser's own hash scroll has already missed it.
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#objections") {
      anchor.current?.scrollIntoView?.({ block: "start" });
    }
  }, []);

  const detailRow = data.rows.find((r) => r.key === detailKey);
  const detail = detailRow !== undefined ? mapObjectionDetail(detailRow, result) : undefined;
  const set = (patch: Partial<ObjectionFilterState>): void =>
    setFilters((f) => ({ ...f, ...patch }));

  return (
    <div id="objections" ref={anchor} style={{ scrollMarginTop: 16 }}>
      <Card testId="stress-test-objection-table">
        <div className={styles.head}>
          <div className={styles.titleWrap}>
            <span className={styles.icon} aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <line x1="12" y1="7" x2="12" y2="11" />
                <line x1="12" y1="14" x2="12.01" y2="14" />
              </svg>
            </span>
            <div>
              <h2 className={styles.title}>Tabel Simulasi Keberatan Pembeli</h2>
              <p className={styles.subtitle}>
                Daftar semua keberatan yang muncul dari simulasi persona AI, diurutkan dari yang
                paling sering / paling kuat.
              </p>
            </div>
          </div>
          <div className={styles.headRight}>
            <div className={styles.headActions}>
              <div className={styles.tabs} role="tablist" aria-label="Filter status">
                {options.tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={filters.tab === tab.id}
                    className={`${styles.tab} ${filters.tab === tab.id ? styles.tabActive : ""}`}
                    onClick={() => set({ tab: tab.id })}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={styles.button}
                disabled={rows.length === 0}
                onClick={() => downloadCsv(objectionsToCsv(rows), objectionsCsvFilename(run.id))}
                data-testid="objection-export-csv"
              >
                Export CSV
              </button>
            </div>
            {options.resolutionNotAssessed ? (
              <span className={styles.mutedNote} data-testid="objection-resolution-note">
                Status resolusi belum dinilai
              </span>
            ) : null}
          </div>
        </div>

        {data.rows.length === 0 ? (
          <p className={styles.mutedNote}>
            {data.personasSimulated === 0
              ? "Tidak ada simulasi persona yang berhasil — belum ada keberatan untuk diringkas."
              : "Persona simulasi tidak mengangkat keberatan."}
          </p>
        ) : (
          <>
            <div className={styles.toolbar}>
              <input
                type="search"
                className={styles.input}
                placeholder="Cari keberatan…"
                aria-label="Cari keberatan"
                value={filters.search}
                onChange={(e) => set({ search: e.target.value })}
              />
              <select
                className={styles.select}
                aria-label="Filter kategori"
                value={filters.category}
                onChange={(e) => set({ category: e.target.value as "ALL" | ObjectionCategory })}
              >
                <option value="ALL">Semua kategori</option>
                {options.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} ({c.count})
                  </option>
                ))}
              </select>
              <select
                className={styles.select}
                aria-label="Filter severity"
                value={filters.severity}
                onChange={(e) =>
                  set({ severity: e.target.value as "ALL" | StressTestObjectionSeverity })
                }
              >
                <option value="ALL">Semua severity</option>
                {(["HIGH", "MEDIUM", "LOW"] as const).map((s) => (
                  <option key={s} value={s}>
                    {OBJECTION_SEVERITY_LABELS[s]}
                  </option>
                ))}
              </select>
              <select
                className={styles.select}
                aria-label="Filter persona"
                value={filters.persona}
                onChange={(e) => set({ persona: e.target.value })}
              >
                <option value="ALL">Semua persona</option>
                {options.personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <select
                className={styles.select}
                aria-label="Urutkan"
                value={filters.sort}
                onChange={(e) => set({ sort: e.target.value as ObjectionSort })}
              >
                {(Object.keys(OBJECTION_SORT_LABELS) as ObjectionSort[]).map((s) => (
                  <option key={s} value={s}>
                    Urut: {OBJECTION_SORT_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Keberatan Pembeli</th>
                    <th>
                      <span
                        className={styles.help}
                        title="Kategori otomatis (berdasarkan kata kunci)"
                      >
                        Kategori
                      </span>
                    </th>
                    <th>Muncul di Persona</th>
                    <th>
                      <span className={styles.help} title={FREQUENCY_TOOLTIP}>
                        Frekuensi (Simulasi)
                      </span>
                    </th>
                    <th>Severity</th>
                    <th>
                      <span
                        className={styles.help}
                        title={assessed ? IMPACT_AI_TOOLTIP : IMPACT_TOOLTIP}
                        data-testid="objection-impact-header"
                      >
                        Dampak ke {goalLabel}
                      </span>
                      {assessed ? (
                        <span
                          className={styles.aiTag}
                          title={IMPACT_AI_TOOLTIP}
                          data-testid="objection-impact-ai-badge"
                        >
                          {AI_ESTIMATE_LABEL}
                        </span>
                      ) : null}
                    </th>
                    <th>
                      <span
                        className={styles.help}
                        title={assessed ? RESOLUTION_AI_TOOLTIP : undefined}
                      >
                        Status Resolusi
                      </span>
                    </th>
                    <th>Rekomendasi Singkat</th>
                    <th>Sumber</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} data-testid="stress-test-objection-row">
                      <td data-label="#" className={styles.rank}>
                        {row.rank}
                      </td>
                      <td data-label="Keberatan Pembeli" className={styles.objection}>
                        {row.objection}
                      </td>
                      <td data-label="Kategori">
                        <span
                          className={`${styles.badge} ${styles[`cat_${OBJECTION_CATEGORY_TONE[row.category]}`] ?? ""}`}
                          title="Kategori otomatis (berdasarkan kata kunci)"
                          data-testid="objection-category"
                        >
                          {row.categoryLabel}
                        </span>
                      </td>
                      <td data-label="Muncul di Persona">
                        <SimulationPersonaStack
                          personas={row.personas}
                          countLabel={`${String(row.personaCount)}/${String(row.personasSimulated)}`}
                        />
                      </td>
                      <td data-label="Frekuensi (Simulasi)">
                        <span
                          className={styles.freq}
                          title={FREQUENCY_TOOLTIP.replace("x%", `${String(row.agreementPct)}%`)}
                          data-testid="stress-test-objection-agreement"
                        >
                          <span>
                            <strong>{row.agreementPct}%</strong> · {row.personaCount}/
                            {row.personasSimulated} persona
                          </span>
                          <span className={styles.bar} aria-hidden="true">
                            <span
                              className={`${styles.barFill} ${styles[`bar_${row.frequencyTone}`] ?? ""}`}
                              style={{ width: `${String(row.agreementPct)}%` }}
                            />
                          </span>
                        </span>
                      </td>
                      <td data-label="Severity">
                        <span
                          className={`${styles.badge} ${styles[`tone_${row.severityTone}`] ?? ""}`}
                        >
                          {row.severityLabel}
                        </span>
                      </td>
                      <td data-label={`Dampak ke ${goalLabel}`}>
                        {row.impact !== undefined ? (
                          <span
                            className={`${styles.badge} ${styles[`res_${GOAL_IMPACT_TONE[row.impact]}`] ?? ""}`}
                            title={IMPACT_AI_TOOLTIP}
                            data-testid="objection-impact"
                          >
                            {row.impactLabel}
                          </span>
                        ) : (
                          <span
                            className={styles.dash}
                            title={IMPACT_TOOLTIP}
                            data-testid="objection-impact"
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td data-label="Status Resolusi">
                        <span
                          className={`${styles.badge} ${
                            row.resolution === "NOT_ASSESSED"
                              ? styles.notAssessed
                              : (styles[`res_${RESOLUTION_TONE[row.resolution]}`] ?? "")
                          }`}
                          title={
                            row.resolution === "NOT_ASSESSED" ? undefined : RESOLUTION_AI_TOOLTIP
                          }
                          data-testid="objection-resolution"
                          data-status={row.resolution}
                        >
                          {row.resolutionLabel}
                        </span>
                      </td>
                      <td data-label="Rekomendasi Singkat" data-testid="objection-recommendation">
                        {row.recommendation ?? <span className={styles.dash}>—</span>}
                      </td>
                      <td data-label="Sumber">
                        <EvidenceBadge kind="SIMULATED" />
                      </td>
                      <td data-label="Aksi">
                        <button
                          type="button"
                          className={styles.detailLink}
                          onClick={() => setDetailKey(row.key)}
                        >
                          Lihat Detail →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 ? (
                <p className={styles.mutedNote}>Tidak ada keberatan yang cocok dengan filter.</p>
              ) : null}
            </div>
            <p className={styles.footnote}>
              {data.totalObjections} keberatan dari {data.personasSimulated} persona simulasi,{" "}
              {data.rows.length} unik (dikelompokkan hanya bila teksnya sama). Frekuensi (Simulasi)
              = persentase persona simulasi yang mengangkatnya — bukan frekuensi pembeli nyata; data
              live (First Message / Respon Pintar) belum terhubung. Kategori ditentukan otomatis
              dari kata kunci.{" "}
              {assessed
                ? "Status resolusi, dampak ke tujuan, dan rekomendasi singkat adalah penilaian AI (simulasi) — bukan data pembeli nyata; status Sudah/Sebagian Terjawab hanya diberikan bila kutipan buktinya benar-benar ada di teks creative."
                : "Dampak dan status resolusi belum dinilai pada run ini."}
            </p>
          </>
        )}
      </Card>
      <ObjectionDetailDrawer
        detail={detail}
        goalLabel={goalLabel}
        onClose={() => setDetailKey(undefined)}
      />
    </div>
  );
}
