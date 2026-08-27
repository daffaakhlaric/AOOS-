"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { ImpersonateResponseDto, ListTenantsDto, TenantDto } from "@/types/tenant.types";

import { CreateTenantModal } from "./CreateTenantModal";
import { EditTenantModal } from "./EditTenantModal";
import styles from "./SuperadminClient.module.css";
import { WebhookConfigCard } from "./WebhookConfigCard";

function badgeClass(status: TenantDto["status"]): string {
  if (status === "ACTIVE") {
    return `${styles.badge} ${styles.badgeActive}`;
  }
  if (status === "TRIAL") {
    return `${styles.badge} ${styles.badgeTrial}`;
  }
  return `${styles.badge} ${styles.badgeSuspended}`;
}

const STATUS_LABEL: Readonly<Record<TenantDto["status"], string>> = {
  TRIAL: "🟡 Trial",
  ACTIVE: "🟢 Aktif",
  SUSPENDED: "🔴 Suspended",
};

/**
 * `/superadmin` Super Admin dashboard (Part 1) — KPI strip + tenant cards + "Buat Tenant Baru" /
 * "Login as Tenant" / "Edit" / "Suspend" actions, all real `apps/aaos-api` calls proxied through
 * this app's own `/api/superadmin/*` routes (middleware-gated to a real `role === 'superadmin'`
 * session — see `middleware.ts`).
 */
export function SuperadminClient(): React.ReactElement {
  const router = useRouter();
  const [data, setData] = useState<ListTenantsDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<TenantDto | undefined>(undefined);
  const [busyTenantId, setBusyTenantId] = useState<string | undefined>(undefined);
  const [actionError, setActionError] = useState<string | undefined>(undefined);

  const load = useCallback(() => {
    setError(undefined);
    fetch("/api/superadmin/tenants")
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(body.error?.message ?? "Gagal memuat data tenant.");
        }
        return (await res.json()) as ListTenantsDto;
      })
      .then(setData)
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat data tenant.");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSuspend(tenant: TenantDto): Promise<void> {
    setBusyTenantId(tenant.tenantId);
    setActionError(undefined);
    try {
      const nextStatus = tenant.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
      const response = await fetch(
        `/api/superadmin/tenants/${encodeURIComponent(tenant.tenantId)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Gagal mengubah status tenant.");
      }
      load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Gagal mengubah status tenant.");
    } finally {
      setBusyTenantId(undefined);
    }
  }

  async function handleImpersonate(tenant: TenantDto): Promise<void> {
    setBusyTenantId(tenant.tenantId);
    setActionError(undefined);
    try {
      const response = await fetch("/api/superadmin/impersonate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.tenantId }),
      });
      const body = (await response.json().catch(() => ({}))) as
        ImpersonateResponseDto | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(
          "error" in body
            ? (body.error?.message ?? "Gagal login sebagai tenant.")
            : "Gagal login sebagai tenant.",
        );
      }
      const { actionLink } = body as ImpersonateResponseDto;
      // Navigates the browser to the real Supabase Auth magic-link verify URL — completes the
      // real sign-in as the tenant admin (coordinator note #1's chosen impersonation mechanism).
      // See app/(auth)/auth/callback/page.tsx for what happens once Supabase redirects back here.
      window.location.href = actionLink;
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Gagal login sebagai tenant.");
      setBusyTenantId(undefined);
    }
  }

  async function handleSignOut(): Promise<void> {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/superadmin/login");
    router.refresh();
  }

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (data === undefined) {
    return <LoadingSpinner />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.title}>⚡ AAOS Super Admin</span>
        <button type="button" className={styles.signOutButton} onClick={() => void handleSignOut()}>
          Logout
        </button>
      </div>

      <WebhookConfigCard />

      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiValue}>{data.kpi.totalTenants}</div>
          <div className={styles.kpiLabel}>Tenant</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiValue}>{data.kpi.activeTenants}</div>
          <div className={styles.kpiLabel}>Aktif</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiValue}>{data.kpi.trialTenants}</div>
          <div className={styles.kpiLabel}>Trial</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiValue}>{data.kpi.suspendedTenants}</div>
          <div className={styles.kpiLabel}>Suspended</div>
        </div>
      </div>

      <div className={styles.tenantsHeader}>
        <span className={styles.sectionTitle}>Tenants</span>
        <button type="button" className={styles.createButton} onClick={() => setShowCreate(true)}>
          + Buat Tenant Baru
        </button>
      </div>

      {actionError !== undefined ? <p className={styles.error}>{actionError}</p> : null}

      <div className={styles.tenantList}>
        {data.tenants.map((tenant) => (
          <div key={tenant.id} className={styles.tenantCard}>
            <div className={styles.tenantTopRow}>
              <span className={styles.tenantName}>{tenant.name}</span>
              <span className={styles.badge}>{tenant.vertical}</span>
              <span className={badgeClass(tenant.status)}>{STATUS_LABEL[tenant.status]}</span>
            </div>
            <div className={styles.tenantMeta}>
              {tenant.tenantId} · {tenant.wabaCount} WABA ·{" "}
              {tenant.hasMetaToken ? "Meta token tersimpan" : "Belum ada Meta token"}
              {tenant.maskedMetaAdAccountId !== undefined
                ? ` (${tenant.maskedMetaAdAccountId})`
                : ""}
            </div>
            <div className={styles.actionsRow}>
              <button
                type="button"
                className={styles.actionButton}
                disabled={busyTenantId === tenant.tenantId}
                onClick={() => void handleImpersonate(tenant)}
              >
                Login as Tenant
              </button>
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => setEditing(tenant)}
              >
                Edit
              </button>
              <button
                type="button"
                className={styles.actionButton}
                disabled={busyTenantId === tenant.tenantId}
                onClick={() => void handleSuspend(tenant)}
              >
                {tenant.status === "SUSPENDED" ? "Aktifkan" : "Suspend"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showCreate ? (
        <CreateTenantModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      ) : null}

      {editing !== undefined ? (
        <EditTenantModal
          tenant={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            load();
          }}
        />
      ) : null}
    </div>
  );
}
