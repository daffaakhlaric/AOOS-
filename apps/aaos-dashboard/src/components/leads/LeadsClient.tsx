"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@tremor/react";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDateId } from "@/lib/formatters";
import type { LeadDto } from "@/types/dashboard.types";

import styles from "./LeadsClient.module.css";

/** Tremor `Badge`'s `color` prop per lead temperature (TREMOR REBUILD spec STEP 16's `STATUS_COLOR` map, translated to Tremor's real `Color` union — see `node_modules/@tremor/react/dist/lib/inputTypes.d.ts`; the spec's raw CSS-color-name literals like `"yellow"` already happen to be valid Tremor colors). `status`/`ASSIGNED`/`CLOSED` aren't real values of `LeadDto.temperature` (only `HOT`/`WARM`/`COLD` are — see `dashboard.types.ts`), so this table's `Badge` is driven by `temperature`, matching what `LeadsClient` actually has to show; `neutral`/`gray` is the safe fallback for anything unrecognized. */
const TEMPERATURE_BADGE_COLOR: Readonly<Record<string, "red" | "amber" | "gray">> = {
  HOT: "red",
  WARM: "amber",
  COLD: "gray",
};

/** All leads overview across every branch (spec "leads/page.tsx" — manager view). Fetches `/api/leads`, which fans out across `aaos-api`'s per-branch `GET /api/v1/leads`. Table rendering restyled onto Tremor's `Table`/`Badge` (TREMOR REBUILD spec STEP 16) — data-fetching logic unchanged (coordinator note #9). */
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
      <div data-testid="leads-list" className={styles.tableWrap}>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Nama</TableHeaderCell>
              <TableHeaderCell>Cabang</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Score</TableHeaderCell>
              <TableHeaderCell>Masuk</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell className={styles.nameCell}>{lead.leadName ?? lead.leadPhone}</TableCell>
                <TableCell className={styles.mutedCell}>{lead.branchId}</TableCell>
                <TableCell>
                  <Badge color={TEMPERATURE_BADGE_COLOR[lead.temperature] ?? "gray"}>
                    {lead.temperature}
                  </Badge>
                </TableCell>
                <TableCell className={styles.scoreCell}>{lead.score}</TableCell>
                <TableCell className={styles.mutedCell}>{formatDateId(lead.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
