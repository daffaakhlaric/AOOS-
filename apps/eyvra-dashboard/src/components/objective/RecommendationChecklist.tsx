"use client";

import { useEffect, useState } from "react";

import type { AdAccountSummaryDto } from "@/types/dashboard.types";
import type { PropertyObjectiveDto } from "@/types/property-objective.types";

import { buildRecommendations } from "./recommendationChecks";
import styles from "./RecommendationChecklist.module.css";

export interface RecommendationChecklistProps {
  readonly existingObjective: PropertyObjectiveDto | undefined;
  /** Real active-listing count — passed down from `PropertyObjectiveForm.tsx`'s own already-loaded `GET /api/listings?status=AKTIF` picker state, so this component does not duplicate that fetch. `undefined` while still loading. */
  readonly activeListingsCount: number | undefined;
}

/**
 * SAMANTHA ADVANCED SPRINT 3 — "Rekomendasi Perbaikan" checklist. Real user feedback this dispatch
 * exists to address: "objective settingannya juga keliatan apa yang harus di perbaiki" (the
 * Objective settings page should show what needs to be fixed). See `recommendationChecks.ts`'s own
 * header doc for why every item here is a real, deterministic comparison — never an LLM call.
 *
 * Self-fetches `/api/campaigns` (same real, already-cached route `CampaignsHubClient`/
 * `MetaAdsClient` use) — mirrors `MarketSignalsCard.tsx`'s own self-contained "own fetch, own
 * loading/error state" convention rather than threading a third data source through
 * `PropertyObjectiveForm`'s already-large prop surface. Only fires once a real objective exists
 * (no point pulling campaign data to evaluate checks that all require `existingObjective` anyway).
 */
export function RecommendationChecklist({
  existingObjective,
  activeListingsCount,
}: RecommendationChecklistProps): React.ReactElement {
  const [campaigns, setCampaigns] = useState<AdAccountSummaryDto["campaigns"] | undefined>(
    undefined,
  );

  useEffect(() => {
    if (existingObjective === undefined) {
      return undefined;
    }
    let cancelled = false;
    fetch("/api/campaigns")
      .then(async (res) => {
        if (!res.ok) throw new Error("Gagal memuat data campaign.");
        return (await res.json()) as AdAccountSummaryDto;
      })
      .then((data) => {
        if (!cancelled) setCampaigns(data.campaigns);
      })
      .catch(() => {
        // Real, honest degrade: a failed/unavailable campaign pull just means the CPL-benchmark and
        // auto-loop-review checks stay silent (see `recommendationChecks.ts` — both require real,
        // computable campaign data) — never surfaced as a hard error on this card, since the
        // checklist as a whole still has real, useful business-context/focus-listing checks to show.
      });
    return () => {
      cancelled = true;
    };
  }, [existingObjective]);

  if (existingObjective === undefined) {
    return (
      <section
        className={styles.section}
        data-testid="recommendation-checklist"
        aria-label="Rekomendasi Perbaikan"
      >
        <h3 className={styles.title}>🛠️ Rekomendasi Perbaikan</h3>
        <p className={styles.empty} data-testid="recommendation-checklist-no-objective">
          Belum ada data untuk direkomendasikan — set objective bulan ini dulu, lalu isi konteks
          bisnis di bawah.
        </p>
      </section>
    );
  }

  const items = buildRecommendations({ existingObjective, activeListingsCount, campaigns });

  return (
    <section
      className={styles.section}
      data-testid="recommendation-checklist"
      aria-label="Rekomendasi Perbaikan"
    >
      <h3 className={styles.title}>🛠️ Rekomendasi Perbaikan</h3>
      {items.length === 0 ? (
        <p className={styles.empty} data-testid="recommendation-checklist-clear">
          Tidak ada isu terdeteksi saat ini — konteks bisnis lengkap dan fokus listing sudah terisi.
          Samantha akan tetap memantau kondisi campaign-mu.
        </p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.key} className={styles.item} data-testid={`recommendation-${item.key}`}>
              <span
                className={`${styles.badge} ${item.severity === "warning" ? styles.badgeWarning : styles.badgeInfo}`}
              >
                {item.severity === "warning" ? "Perlu perhatian" : "Info"}
              </span>
              <span className={styles.text}>{item.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default RecommendationChecklist;
