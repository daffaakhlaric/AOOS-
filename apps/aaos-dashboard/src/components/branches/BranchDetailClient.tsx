"use client";

import { useEffect, useState } from "react";

import {
  AssignmentModeSelector,
  type AssignmentMode,
} from "@/components/branches/AssignmentModeSelector";
import { SalesTeamTable } from "@/components/branches/SalesTeamTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { BranchDto } from "@/types/dashboard.types";

import styles from "./BranchDetailClient.module.css";

/** Branch detail: WhatsApp number, sales team, assignment mode + max leads/day (spec "branches/[branchId]/page.tsx"). */
export function BranchDetailClient({
  branchId,
}: {
  readonly branchId: string;
}): React.ReactElement {
  const [branch, setBranch] = useState<BranchDto | null | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<AssignmentMode>("SMART_ASSIGN");
  const [maxLeadsPerDay, setMaxLeadsPerDay] = useState(10);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function load(): void {
    fetch("/api/branches")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat branch.");
        }
        return (await res.json()) as { branches: readonly BranchDto[] };
      })
      .then((body) => {
        const found = body.branches.find((candidate) => candidate.id === branchId) ?? null;
        setBranch(found);
        if (found !== null) {
          setMode(found.assignmentMode);
          setMaxLeadsPerDay(found.maxLeadsPerSalesPerDay);
        }
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat branch.");
      });
  }

  useEffect(load, [branchId]);

  function handleSave(): void {
    setSaving(true);
    setSaved(false);
    fetch(`/api/branches/${encodeURIComponent(branchId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assignmentMode: mode, maxLeadsPerSalesPerDay: maxLeadsPerDay }),
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal menyimpan perubahan.");
        }
        return (await res.json()) as { branch: BranchDto };
      })
      .then((body) => {
        setBranch(body.branch);
        setSaved(true);
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal menyimpan perubahan.");
      })
      .finally(() => setSaving(false));
  }

  function handleRemoveSales(salesHumanId: string): void {
    fetch(`/api/branches/${encodeURIComponent(branchId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ removeSalesHumanIds: [salesHumanId] }),
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal menghapus sales.");
        }
        return (await res.json()) as { branch: BranchDto };
      })
      .then((body) => setBranch(body.branch))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal menghapus sales.");
      });
  }

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (branch === undefined) {
    return <LoadingSpinner />;
  }
  if (branch === null) {
    return (
      <EmptyState title="Branch tidak ditemukan" description={`Tidak ada branch "${branchId}".`} />
    );
  }

  return (
    <div className={styles.page}>
      <div>
        <h2 className={styles.title}>{branch.displayName}</h2>
        <p className={styles.subtitle}>WhatsApp Nomor Jessy: {branch.wabaPhoneNumber}</p>
      </div>

      <section>
        <h3 className={styles.sectionTitle}>Sales Team</h3>
        <SalesTeamTable team={branch.team} onRemove={handleRemoveSales} />
      </section>

      <section className={styles.settingsSection}>
        <AssignmentModeSelector value={mode} onChange={setMode} />
        <label className={styles.field}>
          Max leads/sales/hari
          <input
            type="number"
            value={maxLeadsPerDay}
            onChange={(event) => setMaxLeadsPerDay(Number(event.target.value))}
            className={styles.numberInput}
          />
        </label>
        <button type="button" onClick={handleSave} disabled={saving} className={styles.saveButton}>
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
        {saved ? <p className={styles.savedNotice}>Perubahan disimpan.</p> : null}
      </section>
    </div>
  );
}
