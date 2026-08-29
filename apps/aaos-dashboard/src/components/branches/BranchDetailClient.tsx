"use client";

import { useEffect, useState } from "react";

import {
  AssignmentModeSelector,
  type AssignmentMode,
} from "@/components/branches/AssignmentModeSelector";
import { ResetPasswordModal } from "@/components/branches/ResetPasswordModal";
import { SalesAccountModal } from "@/components/branches/SalesAccountModal";
import { SalesTeamTable } from "@/components/branches/SalesTeamTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { SalesHumanAccountDto } from "@/types/sales-human-account.types";
import type { BranchDto } from "@/types/dashboard.types";

import styles from "./BranchDetailClient.module.css";

/** Branch detail: WhatsApp number, sales team, assignment mode + max leads/day (spec "branches/[branchId]/page.tsx"). Sales Team is sourced from the REAL, Supabase-backed `/api/sales-humans` (AAOS-SALES-MGMT-CRM-AUTH) — the branch itself (WABA number, assignment mode) still comes from `/api/branches`, `@aos/branch-manager`'s own concern. */
export function BranchDetailClient({
  branchId,
}: {
  readonly branchId: string;
}): React.ReactElement {
  const [branch, setBranch] = useState<BranchDto | null | undefined>(undefined);
  const [team, setTeam] = useState<readonly SalesHumanAccountDto[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<AssignmentMode>("SMART_ASSIGN");
  const [maxLeadsPerDay, setMaxLeadsPerDay] = useState(10);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSales, setEditingSales] = useState<SalesHumanAccountDto | undefined>(undefined);
  const [resetPasswordFor, setResetPasswordFor] = useState<SalesHumanAccountDto | undefined>(
    undefined,
  );

  function loadBranch(): void {
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

  function loadTeam(): void {
    fetch(`/api/sales-humans?branchId=${encodeURIComponent(branchId)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat sales team.");
        }
        return (await res.json()) as { salesHumans: readonly SalesHumanAccountDto[] };
      })
      .then((body) => setTeam(body.salesHumans))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat sales team.");
      });
  }

  useEffect(() => {
    loadBranch();
    loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

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

  function handleDeactivate(salesHumanId: string): void {
    fetch(`/api/sales-humans/${encodeURIComponent(salesHumanId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "OFF" }),
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal menonaktifkan sales.");
        }
        loadTeam();
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal menonaktifkan sales.");
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
        <p className={styles.subtitle}>WhatsApp Nomor Clara: {branch.wabaPhoneNumber}</p>
      </div>

      <section>
        <h3 className={styles.sectionTitle}>
          Sales Team ({team.filter((s) => s.status !== "OFF").length} aktif)
        </h3>
        <SalesTeamTable
          team={team}
          onAddSales={() => setShowAddModal(true)}
          onEdit={(id) => setEditingSales(team.find((s) => s.id === id))}
          onResetPassword={(id) => setResetPasswordFor(team.find((s) => s.id === id))}
          onDeactivate={handleDeactivate}
        />
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

      {showAddModal ? (
        <SalesAccountModal
          branchId={branchId}
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            loadTeam();
          }}
        />
      ) : null}

      {editingSales !== undefined ? (
        <SalesAccountModal
          branchId={branchId}
          editing={editingSales}
          onClose={() => setEditingSales(undefined)}
          onSaved={() => {
            setEditingSales(undefined);
            loadTeam();
          }}
        />
      ) : null}

      {resetPasswordFor !== undefined ? (
        <ResetPasswordModal
          salesHumanId={resetPasswordFor.id}
          salesHumanName={resetPasswordFor.name}
          onClose={() => setResetPasswordFor(undefined)}
          onSaved={() => setResetPasswordFor(undefined)}
        />
      ) : null}
    </div>
  );
}
