"use client";

import { useState } from "react";

import styles from "./SalesAccountModal.module.css";

export interface ResetPasswordModalProps {
  readonly salesHumanId: string;
  readonly salesHumanName: string;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

const MIN_PASSWORD_LENGTH = 8;

/** Reset Password modal (spec Part 1 "Reset Password") — `POST /api/v1/sales-humans/:id/reset-password`, real `supabase.auth.admin.updateUserById` server-side (coordinator note #1). */
export function ResetPasswordModal({
  salesHumanId,
  salesHumanName,
  onClose,
  onSaved,
}: ResetPasswordModalProps): React.ReactElement {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleReset(): Promise<void> {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password minimal ${String(MIN_PASSWORD_LENGTH)} karakter.`);
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const response = await fetch(
        `/api/sales-humans/${encodeURIComponent(salesHumanId)}/reset-password`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password }),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Gagal reset password.");
      }
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal reset password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Reset Password">
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>Reset password untuk {salesHumanName}?</span>
          <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Tutup">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.formGroup}>
            <label htmlFor="reset-password-input" className={styles.formLabel}>
              New password
            </label>
            <input
              id="reset-password-input"
              type="password"
              className={styles.formInput}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
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
            onClick={() => void handleReset()}
            disabled={saving}
          >
            {saving ? "Menyimpan..." : "Reset Password"}
          </button>
        </div>
      </div>
    </div>
  );
}
