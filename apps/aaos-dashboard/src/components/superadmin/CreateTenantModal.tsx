"use client";

import { useState } from "react";

import type { CreateTenantInput, TenantStatus, Vertical } from "@/types/tenant.types";

import styles from "./CreateTenantModal.module.css";

export interface CreateTenantModalProps {
  readonly onClose: () => void;
  readonly onCreated: () => void;
}

const MIN_PASSWORD_LENGTH = 8;

function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "+ Buat Tenant Baru" modal (Part 1) — real `POST /api/superadmin/tenants`, provisioning a real Supabase Auth admin user for the new tenant (coordinator note #1, never a `tenant_admins` row/bcrypt hash). */
export function CreateTenantModal({
  onClose,
  onCreated,
}: CreateTenantModalProps): React.ReactElement {
  const [name, setName] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [tenantIdTouched, setTenantIdTouched] = useState(false);
  const [vertical, setVertical] = useState<Vertical>("AUTOMOTIVE");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [status, setStatus] = useState<TenantStatus>("TRIAL");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaAdAccountId, setMetaAdAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  function handleNameChange(value: string): void {
    setName(value);
    if (!tenantIdTouched) {
      setTenantId(slugify(value));
    }
  }

  function validate(): string | undefined {
    if (name.trim().length === 0) {
      return "Nama perusahaan wajib diisi.";
    }
    if (!/^[a-z0-9-]+$/.test(tenantId)) {
      return "Tenant ID hanya boleh huruf kecil, angka, dan tanda hubung.";
    }
    if (adminEmail.trim().length === 0) {
      return "Email admin wajib diisi.";
    }
    if (adminPassword.length < MIN_PASSWORD_LENGTH) {
      return `Password admin minimal ${String(MIN_PASSWORD_LENGTH)} karakter.`;
    }
    return undefined;
  }

  async function handleSave(): Promise<void> {
    const validationError = validate();
    if (validationError !== undefined) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const body: CreateTenantInput = {
        name,
        tenantId,
        vertical,
        adminEmail,
        adminPassword,
        status,
        ...(metaAccessToken.length > 0 ? { metaAccessToken } : {}),
        ...(metaAdAccountId.length > 0 ? { metaAdAccountId } : {}),
      };
      const response = await fetch("/api/superadmin/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const responseBody = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(responseBody.error?.message ?? "Gagal membuat tenant.");
      }
      onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal membuat tenant.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Buat Tenant Baru">
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>+ Buat Tenant Baru</span>
          <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Tutup">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.formGroup}>
            <label htmlFor="tenant-name" className={styles.formLabel}>
              Nama Perusahaan *
            </label>
            <input
              id="tenant-name"
              className={styles.formInput}
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="PropertyKlik Jakarta"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="tenant-id" className={styles.formLabel}>
              Tenant ID * (slug)
            </label>
            <input
              id="tenant-id"
              className={styles.formInput}
              value={tenantId}
              onChange={(e) => {
                setTenantIdTouched(true);
                setTenantId(slugify(e.target.value));
              }}
              placeholder="propertyklik-jakarta"
            />
          </div>

          <div className={styles.formGroup}>
            <span className={styles.formLabel}>Vertical *</span>
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
            <label htmlFor="tenant-admin-email" className={styles.formLabel}>
              Email Admin *
            </label>
            <input
              id="tenant-admin-email"
              type="email"
              className={styles.formInput}
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@propertyklik.id"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="tenant-admin-password" className={styles.formLabel}>
              Password Admin * (min {MIN_PASSWORD_LENGTH} karakter)
            </label>
            <input
              id="tenant-admin-password"
              type="password"
              className={styles.formInput}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="••••••••••••"
            />
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
                  {option === "TRIAL"
                    ? "Trial (30 hari)"
                    : option === "ACTIVE"
                      ? "Aktif"
                      : "Suspended"}
                </button>
              ))}
            </div>
          </div>

          <hr className={styles.sectionDivider} />
          <span className={styles.sectionLabel}>Meta Ads (opsional)</span>

          <div className={styles.formGroup}>
            <label htmlFor="tenant-meta-token" className={styles.formLabel}>
              Meta Access Token
            </label>
            <input
              id="tenant-meta-token"
              className={styles.formInput}
              value={metaAccessToken}
              onChange={(e) => setMetaAccessToken(e.target.value)}
              placeholder="EAAxxxxxxxxxxxxxxx"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="tenant-meta-ad-account" className={styles.formLabel}>
              Ad Account ID
            </label>
            <input
              id="tenant-meta-ad-account"
              className={styles.formInput}
              value={metaAdAccountId}
              onChange={(e) => setMetaAdAccountId(e.target.value)}
              placeholder="act_752xxxxxx"
            />
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
            {saving ? "Menyimpan..." : "✓ Buat Tenant"}
          </button>
        </div>
      </div>
    </div>
  );
}
