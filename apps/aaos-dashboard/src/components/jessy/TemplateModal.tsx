"use client";

import { useState } from "react";

import type { TemplateDto } from "@/types/dashboard.types";

import styles from "./TemplateModal.module.css";

export interface TemplateModalProps {
  /** `undefined` = create mode (`POST /api/recycling/templates`); a real row = edit mode (`PUT /api/recycling/templates/:id`). */
  readonly editing?: TemplateDto;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

const MAX_CONTENT_LENGTH = 1000;
const VARIABLE_CHIPS = ["{nama}", "{cabang}", "{unit}", "{dp}", "{harga}"] as const;

/** "+ Buat Template Baru" / TAB 2's "[Edit]" modal. */
export function TemplateModal({
  editing,
  onClose,
  onSaved,
}: TemplateModalProps): React.ReactElement {
  const isEdit = editing !== undefined;
  const [name, setName] = useState(editing?.name ?? "");
  const [content, setContent] = useState(editing?.content ?? "");
  const [targetWarm, setTargetWarm] = useState(editing?.targetStatuses.includes("WARM") ?? true);
  const [targetCold, setTargetCold] = useState(editing?.targetStatuses.includes("COLD") ?? false);
  const [cooldownDays, setCooldownDays] = useState(editing?.cooldownDays ?? 3);
  const [status, setStatus] = useState<"ACTIVE" | "DRAFT">(
    editing?.status === "DRAFT" ? "DRAFT" : "ACTIVE",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  function validate(): string | undefined {
    if (name.trim().length === 0) {
      return "Nama template wajib diisi.";
    }
    if (content.trim().length === 0) {
      return "Isi pesan wajib diisi.";
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return `Isi pesan maksimal ${MAX_CONTENT_LENGTH} karakter.`;
    }
    if (!targetWarm && !targetCold) {
      return "Pilih minimal satu Target Status.";
    }
    if (cooldownDays <= 0) {
      return "Cooldown harus lebih dari 0 hari.";
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
      const targetStatuses = [
        ...(targetWarm ? ["WARM"] : []),
        ...(targetCold ? ["COLD"] : []),
      ] as const;
      const url = isEdit ? `/api/recycling/templates/${editing.id}` : "/api/recycling/templates";
      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, content, targetStatuses, cooldownDays, status }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Gagal menyimpan template.");
      }
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menyimpan template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Template Broadcast">
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>
            {isEdit ? "Edit Template Broadcast" : "+ Buat Template Broadcast"}
          </span>
          <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Tutup">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.formGroup}>
            <label htmlFor="template-name" className={styles.formLabel}>
              Nama Template *
            </label>
            <input
              id="template-name"
              className={styles.formInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Promo DP Ringan"
            />
          </div>

          <div className={styles.formGroup}>
            <span className={styles.formLabel}>Target Status *</span>
            <div className={styles.checkboxRow}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={targetWarm}
                  onChange={(e) => setTargetWarm(e.target.checked)}
                />
                WARM
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={targetCold}
                  onChange={(e) => setTargetCold(e.target.checked)}
                />
                COLD
              </label>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="template-cooldown" className={styles.formLabel}>
              Cooldown (hari) *
            </label>
            <input
              id="template-cooldown"
              type="number"
              min={1}
              className={styles.formInputSmall}
              value={cooldownDays}
              onChange={(e) => setCooldownDays(Number(e.target.value))}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="template-content" className={styles.formLabel}>
              Isi Pesan * (max {MAX_CONTENT_LENGTH} karakter)
            </label>
            <textarea
              id="template-content"
              className={styles.formTextarea}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="Halo {nama}! 😊 Ada kabar gembira dari Mobix {cabang}..."
            />
            <div className={styles.chipsRow}>
              {VARIABLE_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className={styles.chip}
                  onClick={() => setContent((current) => `${current}${chip}`)}
                >
                  + {chip}
                </button>
              ))}
            </div>
            <p className={styles.charCount}>
              Karakter: {content.length}/{MAX_CONTENT_LENGTH}
            </p>
          </div>

          {content.length > 0 ? (
            <div>
              <p className={styles.formLabel}>Preview:</p>
              <div className={styles.preview} data-testid="template-preview">
                {content.replaceAll("{nama}", "Pak Hendra").replaceAll("{cabang}", "Cinere")}
              </div>
            </div>
          ) : null}

          <div className={styles.formGroup}>
            <span className={styles.formLabel}>Status</span>
            <div className={styles.checkboxRow}>
              <label className={styles.checkboxLabel}>
                <input
                  type="radio"
                  name="template-status"
                  checked={status === "ACTIVE"}
                  onChange={() => setStatus("ACTIVE")}
                />
                Aktif
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="radio"
                  name="template-status"
                  checked={status === "DRAFT"}
                  onChange={() => setStatus("DRAFT")}
                />
                Draft
              </label>
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
            {saving ? "Menyimpan..." : "✓ Simpan Template"}
          </button>
        </div>
      </div>
    </div>
  );
}
