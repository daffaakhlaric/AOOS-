"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SimulationRunListItem } from "@/lib/stress-test-history";
import { buildRunAgainHref } from "@/lib/stress-test-result";
import { EXPERIMENT_UNAVAILABLE_REASON } from "../result/ExperimentDraftCard";
import styles from "./history.module.css";

export const ARCHIVE_UNAVAILABLE_REASON = "Belum ada endpoint arsip untuk run Stress Test.";
export const DELETE_UNAVAILABLE_REASON = "Belum ada endpoint hapus untuk run Stress Test.";
export const KAI_REQUIRES_RESULT_REASON = "Hanya untuk run yang selesai dengan hasil evaluasi.";

/**
 * Row actions. Every click/keypress is stopped here so it never also triggers the row's own
 * navigation. Actions without a real endpoint are rendered disabled with the honest reason.
 */
export function SimulationRunActions({
  item,
  onCompare,
}: {
  readonly item: SimulationRunListItem;
  readonly onCompare: (runId: string) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent): void {
      if (wrap.current !== null && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const canSendToKai = item.status === "COMPLETED" && item.hasEvaluatedResult;
  const retry = item.failed || item.status === "CANCELLED";

  return (
    <div
      ref={wrap}
      className={styles.actions}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      data-testid="run-actions"
    >
      {item.hasPartialResult ? (
        <Link
          href={item.href}
          className={styles.partialBtn}
          title="Run gagal, tetapi sebagian evaluator sudah menghasilkan output nyata."
          data-testid="run-partial-result"
        >
          Lihat Hasil Parsial
        </Link>
      ) : (
        <Link href={item.href} className={styles.btnPrimary}>
          Lihat Hasil
        </Link>
      )}
      <Link
        href={buildRunAgainHref(item.id, "rerun")}
        className={styles.btn}
        title={
          retry
            ? "Coba lagi (retry) dengan pengaturan yang sama"
            : "Jalankan ulang dengan pengaturan yang sama"
        }
      >
        Run Lagi
      </Link>
      <button
        type="button"
        className={styles.btn}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Aksi lain untuk ${item.name}`}
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open ? (
        <div className={styles.menu} role="menu" aria-label={`Aksi lain untuk ${item.name}`}>
          <Link
            role="menuitem"
            href={buildRunAgainHref(item.id, "duplicate")}
            className={styles.menuItem}
          >
            Duplikat
          </Link>
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            onClick={() => {
              setOpen(false);
              onCompare(item.id);
            }}
          >
            Bandingkan
          </button>
          {canSendToKai ? (
            <Link role="menuitem" href={item.href} className={styles.menuItem}>
              Kirim ke Kai
              <span className={styles.menuReason}>
                Tinjau brief di halaman hasil sebelum dikirim.
              </span>
            </Link>
          ) : (
            <DisabledItem label="Kirim ke Kai" reason={KAI_REQUIRES_RESULT_REASON} />
          )}
          <DisabledItem label="Buat Eksperimen" reason={EXPERIMENT_UNAVAILABLE_REASON} />
          <DisabledItem label="Arsipkan" reason={ARCHIVE_UNAVAILABLE_REASON} />
          <DisabledItem label="Hapus" reason={DELETE_UNAVAILABLE_REASON} />
        </div>
      ) : null}
    </div>
  );
}

function DisabledItem({
  label,
  reason,
}: {
  readonly label: string;
  readonly reason: string;
}): React.ReactElement {
  return (
    <button type="button" role="menuitem" className={styles.menuItem} disabled title={reason}>
      {label}
      <span className={styles.menuReason}>{reason}</span>
    </button>
  );
}
