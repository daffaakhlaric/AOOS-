"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { SkeletonRows } from "@/components/ui/Skeleton";
import { formatDateId } from "@/lib/formatters";
import type { LeadDto } from "@/types/dashboard.types";

import styles from "./LeadsClient.module.css";

/** Tremor `Badge`'s `color` prop per lead temperature (TREMOR REBUILD spec STEP 16's `STATUS_COLOR` map, translated to Tremor's real `Color` union — see `node_modules/@tremor/react/dist/lib/inputTypes.d.ts`; the spec's raw CSS-color-name literals like `"yellow"` already happen to be valid Tremor colors). `status`/`ASSIGNED`/`CLOSED` aren't real values of `LeadDto.temperature` (only `HOT`/`WARM`/`COLD` are — see `dashboard.types.ts`), so this table's `Badge` is driven by `temperature`, matching what `LeadsClient` actually has to show; `neutral`/`gray` is the safe fallback for anything unrecognized. */
const TEMPERATURE_BADGE_COLOR: Readonly<Record<string, "red" | "amber" | "gray">> = {
  HOT: "red",
  WARM: "amber",
  COLD: "gray",
};

/**
 * Leads shown per page, in a pure client-side slice of the already-fully-fetched array (FINAL UI
 * REBUILD spec's "Menampilkan 1-20 dari 48 leads" pagination). `aaos-api`'s real `GET /api/v1/
 * leads` has no `page`/`limit`/`offset` params (`src/app/api/leads/route.ts`'s own docstring
 * confirms it fans out across all branches and concatenates everything in one response), so there
 * is no backend to page against — this paginates the array this component already has in memory,
 * not a new fetch per page.
 */
const PAGE_SIZE = 20;

/**
 * All leads overview across every branch (spec "leads/page.tsx" — manager view). Fetches
 * `/api/leads`, which fans out across `aaos-api`'s per-branch `GET /api/v1/leads`. Table rendering
 * restyled onto Tremor's `Table`/`Badge` (TREMOR REBUILD spec STEP 16) — data-fetching logic
 * unchanged (coordinator note #9).
 *
 * AAOS-CHAT-ROOM-JESSY: each row now links to `/leads/[id]`, the manager chat room — the ONLY
 * change this task makes to this component, per its own coordinator note #4.
 */
export function LeadsClient(): React.ReactElement {
  const [leads, setLeads] = useState<readonly LeadDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);

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
    return (
      <div className={styles.page}>
        <h2 className={styles.title}>Semua Leads</h2>
        <div className={`${styles.tableWrap} ${styles.skeletonPad}`}>
          <SkeletonRows count={6} height="20px" />
        </div>
      </div>
    );
  }
  if (leads.length === 0) {
    return (
      <EmptyState
        icon="🔥"
        title="Belum ada lead"
        description="Lead dari semua cabang akan muncul di sini."
      />
    );
  }

  const pageCount = Math.max(1, Math.ceil(leads.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount);
  const start = (clampedPage - 1) * PAGE_SIZE;
  const pageLeads = leads.slice(start, start + PAGE_SIZE);

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
              <TableHeaderCell>Chat</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageLeads.map((lead) => (
              <TableRow key={lead.id} data-testid="lead-row">
                <TableCell className={styles.nameCell}>
                  <Link href={`/leads/${lead.id}`}>{lead.leadName ?? lead.leadPhone}</Link>
                </TableCell>
                <TableCell className={styles.mutedCell}>{lead.branchId}</TableCell>
                <TableCell>
                  <Badge color={TEMPERATURE_BADGE_COLOR[lead.temperature] ?? "gray"}>
                    {lead.temperature}
                  </Badge>
                </TableCell>
                <TableCell className={styles.scoreCell}>{lead.score}</TableCell>
                <TableCell className={styles.mutedCell}>{formatDateId(lead.createdAt)}</TableCell>
                <TableCell>
                  <Link href={`/leads/${lead.id}`} className={styles.chatLink}>
                    Lihat Chat →
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {pageCount > 1 ? (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            Menampilkan {start + 1}-{Math.min(start + PAGE_SIZE, leads.length)} dari {leads.length}{" "}
            leads
          </span>
          <div className={styles.paginationControls}>
            <button
              type="button"
              className={styles.pageButton}
              disabled={clampedPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Prev
            </button>
            <span className={styles.pageIndicator}>
              {clampedPage} / {pageCount}
            </span>
            <button
              type="button"
              className={styles.pageButton}
              disabled={clampedPage >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
