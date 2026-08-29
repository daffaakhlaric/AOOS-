"use client";

import { useEffect, useMemo, useState } from "react";
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
import { formatDateId, formatRelativeTimeId } from "@/lib/formatters";
import type { BranchDto, LeadDto } from "@/types/dashboard.types";

import styles from "./ContactsClient.module.css";

/** Tremor `Badge`'s `color` prop per lead temperature — same map `LeadsClient` used before this move. */
const TEMPERATURE_BADGE_COLOR: Readonly<Record<string, "red" | "amber" | "gray">> = {
  HOT: "red",
  WARM: "amber",
  COLD: "gray",
};

/**
 * Leads shown per page, in a pure client-side slice of the already-fully-fetched array — `GET
 * /api/v1/leads` (`GetLeadsQueryDto`) has no `page`/`limit` param of its own (verified; MENU
 * RESTRUCTURE FINAL coordinator note #4), only a required `branchId`. Matches the spec mockup's
 * "Showing 1-50 of N" convention.
 */
const PAGE_SIZE = 50;

/**
 * `/clara/contacts` — the real `leads` table across every branch, paginated client-side (MENU
 * RESTRUCTURE FINAL). Replaces the old flat `/leads` list — same `/api/leads` fan-out proxy, same
 * data-fetching logic, restyled with the spec's richer columns (Source, Assigned to, Last Seen)
 * and wired to the real `POST /leads/:id/claim` endpoint for "Assigned to" (coordinator note #4 —
 * `ClaimLeadBodyDto`'s real shape is `{ salesHumanId }`, no new `/leads/:id/assign` endpoint).
 * Row click opens `/clara/inbox?lead=:id` — this app has no separate contact detail page, so a
 * contact's real conversation IS its detail view.
 */
export function ContactsClient(): React.ReactElement {
  const [leads, setLeads] = useState<readonly LeadDto[] | undefined>(undefined);
  const [branches, setBranches] = useState<readonly BranchDto[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [claimingLeadId, setClaimingLeadId] = useState<string | undefined>(undefined);

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

    fetch("/api/branches")
      .then(async (res) =>
        res.ok ? ((await res.json()) as { branches: readonly BranchDto[] }) : { branches: [] },
      )
      .then((body) => setBranches(body.branches))
      .catch(() => undefined);
  }, []);

  const salesNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const branch of branches) {
      for (const sales of branch.team) {
        map.set(sales.id, sales.name);
      }
    }
    return map;
  }, [branches]);

  const filtered = useMemo(() => {
    if (leads === undefined) {
      return [];
    }
    const term = search.trim().toLowerCase();
    if (term.length === 0) {
      return leads;
    }
    return leads.filter(
      (lead) => (lead.leadName ?? "").toLowerCase().includes(term) || lead.leadPhone.includes(term),
    );
  }, [leads, search]);

  async function handleAssign(lead: LeadDto, salesHumanId: string): Promise<void> {
    if (salesHumanId.length === 0) {
      return;
    }
    setClaimingLeadId(lead.id);
    try {
      const response = await fetch(`/api/leads/${lead.id}/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ salesHumanId }),
      });
      if (response.ok) {
        setLeads((current) =>
          current?.map((item) =>
            item.id === lead.id ? { ...item, assignedSalesId: salesHumanId } : item,
          ),
        );
      }
    } finally {
      setClaimingLeadId(undefined);
    }
  }

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (leads === undefined) {
    return (
      <div className={styles.page}>
        <h2 className={styles.title}>Contacts</h2>
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

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount);
  const start = (clampedPage - 1) * PAGE_SIZE;
  const pageLeads = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Contacts</h2>
      </div>

      <input
        type="search"
        placeholder="Cari nama atau nomor..."
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        className={styles.searchInput}
        aria-label="Cari kontak"
      />

      <div data-testid="contacts-list" className={styles.tableWrap}>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Source</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Assigned to</TableHeaderCell>
              <TableHeaderCell>Last Seen</TableHeaderCell>
              <TableHeaderCell>Date</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageLeads.map((lead) => (
              <TableRow key={lead.id} data-testid="contact-row">
                <TableCell className={styles.nameCell}>
                  <Link href={`/clara/inbox?lead=${lead.id}`}>
                    {lead.leadName ?? lead.leadPhone}
                  </Link>
                  <span className={styles.mutedCell}> · {lead.branchId}</span>
                </TableCell>
                <TableCell className={styles.mutedCell}>{lead.leadSource ?? "—"}</TableCell>
                <TableCell>
                  <Badge color={TEMPERATURE_BADGE_COLOR[lead.temperature] ?? "gray"}>
                    {lead.temperature}
                  </Badge>
                </TableCell>
                <TableCell>
                  <select
                    aria-label={`Assigned to untuk ${lead.leadName ?? lead.leadPhone}`}
                    value={lead.assignedSalesId ?? ""}
                    disabled={claimingLeadId === lead.id || lead.assignedSalesId !== undefined}
                    onChange={(event) => void handleAssign(lead, event.target.value)}
                    className={styles.assignSelect}
                  >
                    <option value="">Unassigned</option>
                    {(branches.find((b) => b.id === lead.branchId)?.team ?? []).map((sales) => (
                      <option key={sales.id} value={sales.id}>
                        {sales.name}
                      </option>
                    ))}
                    {lead.assignedSalesId !== undefined &&
                    !(branches.find((b) => b.id === lead.branchId)?.team ?? []).some(
                      (s) => s.id === lead.assignedSalesId,
                    ) ? (
                      <option value={lead.assignedSalesId}>
                        {salesNameById.get(lead.assignedSalesId) ?? lead.assignedSalesId}
                      </option>
                    ) : null}
                  </select>
                </TableCell>
                <TableCell className={styles.mutedCell}>
                  {lead.lastMessageAt !== undefined
                    ? formatRelativeTimeId(lead.lastMessageAt)
                    : "—"}
                </TableCell>
                <TableCell className={styles.mutedCell}>{formatDateId(lead.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className={styles.pagination}>
        <span className={styles.paginationInfo}>
          Showing {filtered.length === 0 ? 0 : start + 1}-
          {Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length}
        </span>
        {pageCount > 1 ? (
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
        ) : null}
      </div>
    </div>
  );
}
