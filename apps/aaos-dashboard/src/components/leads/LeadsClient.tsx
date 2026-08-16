"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateId } from "@/lib/formatters";
import type { LeadDto } from "@/types/dashboard.types";

import styles from "./LeadsClient.module.css";

const TEMPERATURE_TONE = { HOT: "danger", WARM: "warning", COLD: "neutral" } as const;

/** All leads overview across every branch (spec "leads/page.tsx" — manager view). Fetches `/api/leads`, which fans out across `aaos-api`'s per-branch `GET /api/v1/leads`. */
export function LeadsClient(): React.ReactElement {
  const [leads, setLeads] = useState<readonly LeadDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch("/api/leads")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat leads.");
        }
        return (await res.json()) as { leads: readonly LeadDto[] };
      })
      .then((body) => setLeads(body.leads))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat leads.");
      });
  }, []);

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (leads === undefined) {
    return <LoadingSpinner />;
  }
  if (leads.length === 0) {
    return (
      <EmptyState
        title="Belum ada lead"
        description="Lead dari semua cabang akan muncul di sini."
      />
    );
  }

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Semua Leads</h2>
      <ul data-testid="leads-list" className={styles.list}>
        {leads.map((lead) => (
          <li key={lead.id} className={styles.row}>
            <span className={styles.name}>{lead.leadName ?? lead.leadPhone}</span>
            <span className={styles.meta}>{lead.branchId}</span>
            <StatusBadge
              label={lead.temperature}
              tone={
                TEMPERATURE_TONE[lead.temperature as keyof typeof TEMPERATURE_TONE] ?? "neutral"
              }
            />
            <span className={styles.meta}>{formatDateId(lead.createdAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
