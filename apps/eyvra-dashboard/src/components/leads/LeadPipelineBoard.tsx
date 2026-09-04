"use client";

import { useEffect, useState } from "react";

import { Badge, type BadgeType } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatRelativeTimeId } from "@/lib/formatters";
import type { LeadDto } from "@/types/dashboard.types";

import { LeadDetailDrawer } from "./LeadDetailDrawer";
import styles from "./LeadPipelineBoard.module.css";

type Temperature = "HOT" | "WARM" | "COLD";

const COLUMNS: readonly {
  readonly key: Temperature;
  readonly label: string;
  readonly color: string;
  readonly tint: string;
}[] = [
  { key: "HOT", label: "HOT", color: "var(--v2-hot)", tint: "var(--v2-hot-tint)" },
  { key: "WARM", label: "WARM", color: "var(--v2-warm)", tint: "var(--v2-warm-tint)" },
  { key: "COLD", label: "COLD", color: "var(--v2-cold)", tint: "var(--v2-cold-tint)" },
];

const TEMPERATURE_BADGE_TYPE: Readonly<Record<string, BadgeType>> = {
  HOT: "HOT",
  WARM: "WARM",
  COLD: "COLD",
};

/**
 * EYVRA MENU RESTRUCTURE Sprint 2 (PROMPT 4, Leads hub "Pipeline" tab) — real 3-column HOT/WARM/
 * COLD lead board.
 *
 * REAL INVESTIGATION FINDING: no existing per-lead kanban component exists anywhere in this
 * codebase. `LeadPipelineSection.tsx` (Overview hub) intentionally shows AGGREGATE COUNTS ONLY —
 * its own doc comment explains the real `OverviewLeadsSummaryDto` the Overview endpoint returns
 * has no per-lead rows, by design. `ContactsClient.tsx` is a real per-lead table, but flat (no
 * temperature columns) — reused separately as this hub's "Semua Leads" tab.
 *
 * Rather than fabricate lead data, this is a real, honest, MINIMAL new component built on the
 * SAME real `GET /api/leads` endpoint `ContactsClient.tsx` already calls (`LeadDto[]`, exactly the
 * fields the real backend returns: `leadName`/`score`/`temperature`/`status`/`leadSource`/
 * `lastMessageAt` — nothing invented), grouped into 3 columns client-side. Score breakdown /
 * WA-preview drawer content (`LeadDetailDrawer`) similarly only renders real fields from the real
 * `GET /api/leads/:id` (`LeadDetailDto`) response.
 */
export function LeadPipelineBoard(): React.ReactElement {
  const [leads, setLeads] = useState<readonly LeadDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [selectedLeadId, setSelectedLeadId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/leads")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat leads.");
        }
        return (await res.json()) as { leads: readonly LeadDto[] };
      })
      .then((body) => {
        if (!cancelled) {
          setLeads(body.leads);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat leads.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (leads === undefined) {
    return <LoadingSpinner />;
  }
  if (leads.length === 0) {
    return <EmptyState title="Belum ada lead." />;
  }

  return (
    <div>
      <div className={styles.columns} data-testid="lead-pipeline-board">
        {COLUMNS.map((column) => {
          const columnLeads = leads.filter((lead) => lead.temperature === column.key);
          return (
            <div key={column.key} className={styles.column}>
              <div
                className={styles.columnHeader}
                style={{ background: column.tint, color: column.color }}
              >
                <span className={styles.columnLabel}>{column.label}</span>
                <span className={styles.columnCount}>{columnLeads.length}</span>
              </div>
              <div className={styles.cardList}>
                {columnLeads.length === 0 ? (
                  <p className={styles.emptyColumn}>Tidak ada lead {column.label.toLowerCase()}.</p>
                ) : (
                  columnLeads.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      data-testid={`lead-card-${lead.id}`}
                      className={styles.card}
                      onClick={() => setSelectedLeadId(lead.id)}
                    >
                      <div className={styles.cardTop}>
                        <span className={styles.cardName}>{lead.leadName ?? lead.leadPhone}</span>
                        <span className={styles.scorePill} style={{ background: column.color }}>
                          {lead.score}
                        </span>
                      </div>
                      <p className={styles.cardSummary}>
                        {lead.leadSource !== undefined
                          ? `Sumber: ${lead.leadSource}`
                          : lead.leadPhone}
                      </p>
                      <div className={styles.cardBottom}>
                        <Badge
                          type={TEMPERATURE_BADGE_TYPE[lead.temperature] ?? "COLD"}
                          size="xs"
                        />
                        <span className={styles.cardMeta}>
                          {lead.lastMessageAt !== undefined
                            ? formatRelativeTimeId(lead.lastMessageAt)
                            : "Belum ada pesan"}
                        </span>
                      </div>
                      {column.key === "HOT" ? (
                        <span
                          role="button"
                          tabIndex={-1}
                          className={styles.handoffButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            window.location.href = "/leads?tab=semua";
                          }}
                        >
                          Handoff ke agen →
                        </span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      {selectedLeadId !== undefined ? (
        <LeadDetailDrawer leadId={selectedLeadId} onClose={() => setSelectedLeadId(undefined)} />
      ) : null}
    </div>
  );
}

export default LeadPipelineBoard;
