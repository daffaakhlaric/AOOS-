"use client";
import { useState } from "react";
import { Card } from "@/components/common/Card";
import { Drawer } from "@/components/common/Drawer";
import {
  COPY_DIMENSION_STATUS_LABELS,
  OBJECTION_SEVERITY_LABELS,
  type StressTestDimensionKey,
  type StressTestEvaluatedResultDto,
} from "@/lib/stress-test";
import { SEVERITY_TONE, buildDimensionGrid, dimensionEvidence } from "@/lib/stress-test-result";
import { EvidenceBadge, ToneBadge } from "./EvidenceBadge";
import styles from "./result.module.css";

/** 8-cell dimension grid. Only Hook/Offer/CTA/Objection Handling have a real evaluator; the other 4
 * render "N/A" (never 0 or a number). Clicking a scored cell opens its real evidence. */
export function DimensionGrid({
  result,
}: {
  readonly result: StressTestEvaluatedResultDto;
}): React.ReactElement {
  const cells = buildDimensionGrid(result);
  const [open, setOpen] = useState<
    { readonly dimension: StressTestDimensionKey; readonly label: string } | undefined
  >();
  const evidence = open !== undefined ? dimensionEvidence(result, open.dimension) : undefined;
  const openScore =
    open !== undefined
      ? result.dimensionScores.find((d) => d.dimension === open.dimension)?.score
      : undefined;

  return (
    <Card
      title="Skor per Dimensi"
      subtitle="Klik dimensi bernilai untuk melihat bukti evaluator."
      testId="stress-test-dimension-grid"
    >
      <div className={styles.dimensionGrid}>
        {cells.map((cell) =>
          cell.kind === "SCORED" ? (
            <button
              key={cell.label}
              type="button"
              className={styles.dimensionCell}
              onClick={() => setOpen({ dimension: cell.dimension, label: cell.label })}
              data-testid={`stress-test-dimension-${cell.dimension}`}
            >
              <span className={styles.dimensionLabel}>{cell.label}</span>
              <span className={styles.dimensionValue}>{cell.score}</span>
              <div className={styles.bar}>
                <div
                  className={styles.barFill}
                  style={{ width: `${String(Math.max(0, Math.min(100, cell.score)))}%` }}
                />
              </div>
            </button>
          ) : (
            <div
              key={cell.label}
              className={`${styles.dimensionCell} ${styles.dimensionCellMuted}`}
              data-testid={`stress-test-dimension-na-${cell.label}`}
            >
              <span className={styles.dimensionLabel}>{cell.label}</span>
              <span className={styles.dimensionValue}>
                {cell.kind === "NOT_EVALUATED" ? "N/A" : "—"}
              </span>
              <span className={styles.muted}>
                {cell.kind === "NOT_EVALUATED"
                  ? "Evaluator belum tersedia"
                  : "Evaluator gagal pada run ini"}
              </span>
            </div>
          ),
        )}
      </div>
      <Drawer
        open={open !== undefined}
        onClose={() => setOpen(undefined)}
        title={open ? `Bukti: ${open.label}` : "Bukti"}
      >
        {open !== undefined && evidence !== undefined ? (
          <div data-testid="stress-test-dimension-drawer">
            <p>
              Skor: <strong>{openScore ?? "—"}</strong>/100
            </p>
            {evidence.copyReasoning !== undefined ? (
              <div>
                <span className={styles.sectionLabel}>Copy Evaluator</span>
                <p>
                  <strong>{COPY_DIMENSION_STATUS_LABELS[evidence.copyReasoning.status]}</strong> —{" "}
                  {evidence.copyReasoning.reasoning}
                </p>
              </div>
            ) : null}
            {open.dimension === "OBJECTION_HANDLING" ? (
              evidence.objections.length > 0 ? (
                <div>
                  <div className={styles.badgeRow}>
                    <span className={styles.sectionLabel}>Keberatan dari simulasi persona</span>
                    <EvidenceBadge kind="SIMULATED" />
                  </div>
                  <ul className={styles.plainList}>
                    {evidence.objections.map((o, i) => (
                      <li key={`${o.personaLabel}-${String(i)}`}>
                        {o.objection}{" "}
                        <ToneBadge tone={SEVERITY_TONE[o.severity]}>
                          {OBJECTION_SEVERITY_LABELS[o.severity]}
                        </ToneBadge>{" "}
                        <span className={styles.muted}>— {o.personaLabel}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p>Tidak ada keberatan dari persona simulasi.</p>
              )
            ) : evidence.copyReasoning === undefined ? (
              <p>Alasan evaluator tidak tersedia untuk dimensi ini.</p>
            ) : null}
            <p className={styles.note}>
              Pemetaan skor mengikuti aturan backend yang diungkapkan (status copy / penalti
              keberatan) — bukan kalibrasi terhadap performa iklan nyata.
            </p>
          </div>
        ) : null}
      </Drawer>
    </Card>
  );
}
