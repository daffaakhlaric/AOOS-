"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { SimulationHistoryEntryDto } from "@/types/dashboard.types";

import styles from "./GoLiveClient.module.css";

/**
 * `/go-live` — Go Live Monitor (MENU RESTRUCTURE FINAL, coordinator note #5). A REAL page, built
 * as a deliberate, honest placeholder: `@aos/`... no — `apps/aaos-api`'s real
 * `SimulationStatus` union (`apps/aaos-api/src/modules/simulation/domain/simulation-record.ts`)
 * is `"RUNNING" | "DONE" | "ERROR"` — there is NO `"LIVE"` status anywhere in the real domain
 * model, and this session has twice before declined to build Simulasi's actual "Go Live"
 * execution feature (the capability to actually launch a real Meta Ads campaign from an approved
 * simulation does not exist).
 *
 * This page queries the real `GET /api/v1/simulation/history` list and filters for a status
 * (`"LIVE"`) that structurally cannot appear in `SimulationHistoryEntryDto.status` — so it always,
 * honestly, resolves to zero rows and always renders the empty state below. This is intentional,
 * not a bug: it is the honest alternative to either (a) fabricating a "LIVE" status on the real
 * `SimulationStatus` enum, or (b) silently reinterpreting `DONE` + `decision: "APPROVED"` as "a
 * running campaign" (a `DONE` simulation is finished analysis, not a live campaign — conflating
 * the two would misrepresent real data). Pause/Rollback/Detail buttons from the spec's card mockup
 * are deliberately never rendered — there are never any cards to attach them to, and building
 * disabled/dead buttons instead would misleadingly suggest cards could appear via a button click
 * rather than a real, not-yet-built Go Live execution feature.
 *
 * A future task extending Go Live execution should start here: add a real "LIVE" status (or an
 * equivalent real "launched campaign" record) to `SimulationStatus`/`SimulationHistoryEntryDto`,
 * then replace the always-empty filter below with a real one.
 */
export function GoLiveClient(): React.ReactElement {
  const [history, setHistory] = useState<readonly SimulationHistoryEntryDto[] | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch("/api/simulation/history")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat data simulasi.");
        }
        return (await res.json()) as { history: readonly SimulationHistoryEntryDto[] };
      })
      .then((body) => setHistory(body.history))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat data simulasi.");
      });
  }, []);

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (history === undefined) {
    return <LoadingSpinner />;
  }

  // Honest, always-empty-for-now query — see this component's own docstring: `"LIVE"` cannot
  // structurally appear in `SimulationHistoryEntryDto.status` (`"RUNNING" | "DONE" | "ERROR"`
  // only), so `liveCampaigns` is always `[]` until a real Go Live execution feature adds a real
  // "launched campaign" status/record to query against.
  const liveCampaigns = history.filter((entry) => (entry.status as string) === "LIVE");

  return (
    <div className={styles.page}>
      <div className={styles.kpiStrip} data-testid="go-live-kpi-strip">
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>LIVE</p>
          <p className={styles.kpiValue}>0</p>
        </div>
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>PAUSED</p>
          <p className={styles.kpiValue}>0</p>
        </div>
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>TOTAL SPEND</p>
          <p className={styles.kpiValue}>Rp 0</p>
        </div>
        <div className={styles.kpiCell}>
          <p className={styles.kpiLabel}>HOT LEADS HARI INI</p>
          <p className={styles.kpiValue}>0</p>
        </div>
      </div>

      {liveCampaigns.length === 0 ? (
        <EmptyState
          icon="🚀"
          title="Belum ada campaign live"
          description="Mulai dari menu Simulasi."
        />
      ) : null}
    </div>
  );
}
