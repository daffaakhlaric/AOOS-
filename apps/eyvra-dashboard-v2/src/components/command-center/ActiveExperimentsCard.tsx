"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import type { AbTestDto } from "@/types/dashboard.types";

import styles from "./ActiveExperimentsCard.module.css";

export function ActiveExperimentsCard(): React.ReactElement {
  const [tests, setTests] = useState<readonly AbTestDto[] | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/abtesting?status=RUNNING")
      .then((res) => (res.ok ? (res.json() as Promise<{ tests: readonly AbTestDto[] }>) : null))
      .then((body) => {
        if (!cancelled) {
          if (body === null) {
            setFailed(true);
          } else {
            setTests(body.tests);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return <ErrorState message="Data eksperimen belum bisa dimuat." />;
  }
  if (tests === undefined) {
    return <LoadingState processLabel="Memuat eksperimen aktif..." />;
  }
  if (tests.length === 0) {
    return (
      <EmptyState
        title="Tidak ada eksperimen aktif"
        description="Samantha will launch a test when a valid hypothesis is available."
      />
    );
  }

  return (
    // Row-E compact slot this round (~135-155px height budget, beside Kai Production) — capped
    // tighter than before (was 5); never padded, real `tests.length` can be shorter.
    <ul className={styles.list} data-testid="cc-active-experiments">
      {tests.slice(0, 1).map((test) => (
        <li key={test.id} className={styles.row}>
          <span className={styles.name}>{test.name}</span>
          <span className={styles.meta}>
            {test.variants.length} varian
            {test.startedAt !== undefined
              ? ` · mulai ${new Date(test.startedAt).toLocaleDateString("id-ID")}`
              : ""}
          </span>
          <div className={styles.variants}>
            {test.variants.slice(0, 3).map((variant) => (
              <div key={variant.id}>
                {variant.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- real backend media URL
                  <img
                    src={variant.imageUrl}
                    alt={variant.variantLabel ?? variant.label ?? "Variant"}
                  />
                ) : (
                  <span className={styles.placeholder}>▧</span>
                )}
                <span>{variant.variantLabel ?? variant.label ?? variant.id.slice(0, 8)}</span>
              </div>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
