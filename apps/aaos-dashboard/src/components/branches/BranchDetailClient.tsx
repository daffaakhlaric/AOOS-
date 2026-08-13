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
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h2 className="text-base font-semibold text-ink">{branch.displayName}</h2>
        <p className="text-sm text-ink-muted">WhatsApp Nomor Jessy: {branch.wabaPhoneNumber}</p>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-ink">Sales Team</h3>
        <SalesTeamTable team={branch.team} onRemove={handleRemoveSales} />
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-hairline bg-surface-card p-4 shadow-card">
        <AssignmentModeSelector value={mode} onChange={setMode} />
        <label className="flex items-center gap-2 text-sm text-ink">
          Max leads/sales/hari
          <input
            type="number"
            value={maxLeadsPerDay}
            onChange={(event) => setMaxLeadsPerDay(Number(event.target.value))}
            className="w-20 rounded-button border border-hairline px-2 py-1"
          />
        </label>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="self-start rounded-button bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
        {saved ? <p className="text-sm text-brand-success">Perubahan disimpan.</p> : null}
      </section>
    </div>
  );
}
