"use client";

import { useState } from "react";

import type { TenantDto, TenantStatus, UpdateTenantInput, Vertical } from "@/types/tenant.types";

import styles from "./CreateTenantModal.module.css";

export interface EditTenantModalProps {
  readonly tenant: TenantDto;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

/** "Edit" action on a tenant card (Part 1) — real `PUT /api/superadmin/tenants/:id`. Reuses `CreateTenantModal.module.css`'s classes directly (same visual language, no new stylesheet needed for this simpler form). */
export function EditTenantModal({
  tenant,
  onClose,
  onSaved,
}: EditTenantModalProps): React.ReactElement {
  const [name, setName] = useState(tenant.name);
  const [vertical, setVertical] = useState<Vertical>(tenant.vertical);
  const [status, setStatus] = useState<TenantStatus>(tenant.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleSave(): Promise<void> {
    if (name.trim().length === 0) {
      setError("Nama perusahaan wajib diisi.");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const body: UpdateTenantInput = { name, vertical, status };
      const response = await fetch(
        `/api/superadmin/tenants/${encodeURIComponent(tenant.tenantId)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        const responseBody = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(responseBody.error?.message ?? "Gagal menyimpan tenant.");
      }
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menyimpan tenant.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Edit Tenant">
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>Edit Tenant — {tenant.tenantId}</span>
          <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Tutup">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.formGroup}>
            <label htmlFor="edit-tenant-name" className={styles.formLabel}>
              Nama Perusahaan *
            </label>
            <input
              id="edit-tenant-name"
              className={styles.formInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <span className={styles.formLabel}>Vertical</span>
            <div className={styles.optionRow}>
              {(["AUTOMOTIVE", "PROPERTY"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setVertical(option)}
                  className={`${styles.optionButton} ${vertical === option ? styles.optionButtonActive : ""}`}
                >
                  {option === "AUTOMOTIVE" ? "Automotive" : "Property"}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <span className={styles.formLabel}>Status</span>
            <div className={styles.optionRow}>
              {(["TRIAL", "ACTIVE", "SUSPENDED"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatus(option)}
                  className={`${styles.optionButton} ${status === option ? styles.optionButtonActive : ""}`}
                >
                  {option === "TRIAL" ? "Trial" : option === "ACTIVE" ? "Aktif" : "Suspended"}
                </button>
              ))}
            </div>
          </div>

          {error !== undefined ? <p className={styles.error}>{error}</p> : null}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className={styles.saveButton}
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? "Menyimpan..." : "✓ Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
