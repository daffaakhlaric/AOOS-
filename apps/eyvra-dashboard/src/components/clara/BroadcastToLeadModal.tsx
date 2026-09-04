"use client";

import { useState } from "react";

import type { RecyclingPoolLeadDto, TemplateDto } from "@/types/dashboard.types";

import styles from "./BroadcastToLeadModal.module.css";

export interface BroadcastToLeadModalProps {
  readonly lead: RecyclingPoolLeadDto;
  /** Already-filtered to ACTIVE templates whose `targetStatuses` include this lead's status. */
  readonly templates: readonly TemplateDto[];
  readonly onClose: () => void;
  readonly onSent: () => void;
}

/**
 * Real, honest substitutions only — mirrors `aaos-api`'s `RecyclingService`'s own `renderTemplate`
 * exactly ({nama}/{cabang}), never fabricating {unit}/{dp}/{harga}/etc — see that function's own
 * doc for why. Any other placeholder is left un-substituted in this client-side preview too, so
 * the preview never lies about what will actually be sent.
 */
function renderPreview(content: string, lead: RecyclingPoolLeadDto): string {
  return content.replaceAll("{nama}", lead.leadName ?? "Kak").replaceAll("{cabang}", lead.branchId);
}

/** TAB 1's "Kirim ▶" modal — pick a template, preview the real rendered message, send. */
export function BroadcastToLeadModal({
  lead,
  templates,
  onClose,
  onSent,
}: BroadcastToLeadModalProps): React.ReactElement {
  const [templateId, setTemplateId] = useState<string | undefined>(templates[0]?.id);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const selected = templates.find((t) => t.id === templateId);

  async function handleSend(): Promise<void> {
    if (templateId === undefined) {
      setError("Pilih template terlebih dahulu.");
      return;
    }
    setSending(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/recycling/broadcast/${lead.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Gagal mengirim broadcast.");
      }
      onSent();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal mengirim broadcast.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Broadcast ke lead">
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>Broadcast ke {lead.leadName ?? lead.leadPhone}</span>
          <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Tutup">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.leadMeta}>
            Score: {lead.score} · {lead.status} · {lead.leadPhone}
          </p>

          {templates.length === 0 ? (
            <p className={styles.noTemplates}>
              Tidak ada template aktif yang cocok untuk status {lead.status} lead ini.
            </p>
          ) : (
            <>
              <p className={styles.sectionLabel}>Pilih Template:</p>
              <div className={styles.templateList}>
                {templates.map((template) => (
                  <label key={template.id} className={styles.templateOption}>
                    <input
                      type="radio"
                      name="template"
                      value={template.id}
                      checked={templateId === template.id}
                      onChange={() => setTemplateId(template.id)}
                    />
                    {template.name}
                  </label>
                ))}
              </div>

              {selected !== undefined ? (
                <>
                  <p className={styles.sectionLabel}>Preview pesan:</p>
                  <div className={styles.preview} data-testid="broadcast-preview">
                    {renderPreview(selected.content, lead)}
                  </div>
                </>
              ) : null}
            </>
          )}

          {error !== undefined ? <p className={styles.error}>{error}</p> : null}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className={styles.sendButton}
            onClick={() => void handleSend()}
            disabled={sending || templates.length === 0}
          >
            {sending ? "Mengirim..." : "📤 Kirim Sekarang"}
          </button>
        </div>
      </div>
    </div>
  );
}
