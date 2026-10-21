"use client";
import { Drawer } from "@/components/common/Drawer";
import { CLAIM_STATUS_LABELS, OBJECTION_SEVERITY_LABELS } from "@/lib/stress-test";
import {
  AI_ESTIMATE_LABEL,
  GOAL_IMPACT_TONE,
  OBJECTION_CATEGORY_TONE,
  RESOLUTION_TONE,
  type ObjectionDetail,
} from "@/lib/stress-test-objections";
import { SEVERITY_TONE, evidenceForClaim } from "@/lib/stress-test-result";
import { EvidenceBadge } from "../result/EvidenceBadge";
import styles from "./objections.module.css";

/** "Lihat Detail" drawer — every field is a real value or an explicit "Belum dinilai / Belum terhubung". */
export function ObjectionDetailDrawer({
  detail,
  goalLabel,
  onClose,
}: {
  readonly detail: ObjectionDetail | undefined;
  readonly goalLabel: string;
  readonly onClose: () => void;
}): React.ReactElement | null {
  if (detail === undefined) return null;
  const { row } = detail;
  return (
    <Drawer open onClose={onClose} title="Detail Keberatan">
      <div data-testid="objection-detail-drawer">
        <p style={{ fontSize: 15, fontWeight: 600, marginTop: 0 }}>“{row.objection}”</p>
        <p style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <EvidenceBadge kind="SIMULATED" />
          {detail.needsKnowledge ? (
            <span
              className={styles.flag}
              title="Butuh data / Listing Knowledge untuk menjawab keberatan ini dengan fakta (Fact Validator tidak berjalan, atau penilaian AI: Butuh Knowledge)."
            >
              Butuh Knowledge
            </span>
          ) : null}
        </p>
        <dl className={styles.dl}>
          <dt>Kategori</dt>
          <dd>
            <span
              className={`${styles.badge} ${styles[`cat_${OBJECTION_CATEGORY_TONE[row.category]}`] ?? ""}`}
            >
              {row.categoryLabel}
            </span>
            <span className={styles.mutedNote} style={{ display: "block", marginTop: 4 }}>
              {detail.categoryNote}
            </span>
          </dd>
          <dt>Severity</dt>
          <dd>
            <span
              className={`${styles.badge} ${styles[`tone_${SEVERITY_TONE[row.severity]}`] ?? ""}`}
            >
              {row.severityLabel}
            </span>
          </dd>
          <dt>Kesepakatan simulasi</dt>
          <dd>{detail.agreementLabel}</dd>
          <dt>Frekuensi live</dt>
          <dd className={styles.dash}>Data live belum terhubung (First Message / Respon Pintar)</dd>
          <dt>Dampak ke {goalLabel}</dt>
          {row.impact !== undefined ? (
            <dd>
              <span
                className={`${styles.badge} ${styles[`res_${GOAL_IMPACT_TONE[row.impact]}`] ?? ""}`}
              >
                {row.impactLabel}
              </span>
              <span className={styles.aiTag}>{AI_ESTIMATE_LABEL}</span>
            </dd>
          ) : (
            <dd className={styles.dash}>Belum dinilai pada run ini</dd>
          )}
          <dt>Status resolusi</dt>
          {detail.assessed ? (
            <dd data-testid="objection-detail-resolution">
              <span
                className={`${styles.badge} ${styles[`res_${RESOLUTION_TONE[row.resolution]}`] ?? ""}`}
              >
                {row.resolutionLabel}
              </span>
              <span className={styles.aiTag}>{AI_ESTIMATE_LABEL}</span>
              {row.adjustment === "EVIDENCE_NOT_FOUND" ? (
                <span className={styles.mutedNote} style={{ display: "block", marginTop: 4 }}>
                  AI menilai keberatan ini terjawab, tetapi kutipan buktinya tidak ditemukan di teks
                  creative — diturunkan otomatis menjadi Belum Terjawab.
                </span>
              ) : null}
              {row.adjustment === "UNGROUNDED_TERM" ? (
                <span className={styles.mutedNote} style={{ display: "block", marginTop: 4 }}>
                  Rekomendasi AI menyebut fakta yang tidak ada di data listing/creative — diganti
                  menjadi kebutuhan data.
                </span>
              ) : null}
            </dd>
          ) : (
            <dd className={styles.dash} data-testid="objection-detail-resolution">
              {row.resolutionLabel} — belum dinilai pada run ini
            </dd>
          )}
          <dt>Rekomendasi</dt>
          <dd className={row.recommendation === undefined ? styles.dash : undefined}>
            {row.recommendation ?? "— (tidak ada rekomendasi per keberatan pada hasil simulasi)"}
          </dd>
          {detail.assessed ? (
            <>
              <dt>Bukti di creative</dt>
              {row.evidence !== undefined ? (
                <dd>
                  <blockquote className={styles.evidence} data-testid="objection-detail-evidence">
                    “{row.evidence}”
                  </blockquote>
                  <span className={styles.mutedNote}>
                    Kutipan persis dari teks creative (diverifikasi server).
                  </span>
                </dd>
              ) : (
                <dd className={styles.dash} data-testid="objection-detail-evidence">
                  — (tidak ada kutipan di creative yang menjawab keberatan ini)
                </dd>
              )}
            </>
          ) : null}
        </dl>

        <h3 className={styles.sectionTitle}>Persona yang memunculkan</h3>
        <ul className={styles.personaList}>
          {row.personas.map((p) => (
            <li
              key={p.personaId}
              className={styles.personaItem}
              data-testid="objection-detail-persona"
            >
              <div className={styles.personaHead}>
                <span>{p.label}</span>
                <span
                  className={`${styles.badge} ${styles[`tone_${SEVERITY_TONE[p.severity]}`] ?? ""}`}
                >
                  {OBJECTION_SEVERITY_LABELS[p.severity]}
                </span>
              </div>
              <span>“{p.text}”</span>
            </li>
          ))}
        </ul>

        {detail.relatedFindings.length > 0 ? (
          <>
            <h3 className={styles.sectionTitle}>Temuan Fact-check terkait</h3>
            <ul className={styles.personaList}>
              {detail.relatedFindings.map((f, i) => (
                <li key={`${f.claim}-${String(i)}`} className={styles.personaItem}>
                  <div className={styles.personaHead}>
                    <span>{CLAIM_STATUS_LABELS[f.status]}</span>
                    <EvidenceBadge kind={evidenceForClaim(f)} />
                  </div>
                  <span>{f.reasoning}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <p className={styles.footnote}>
          Keberatan ini berasal dari simulasi persona AI, bukan pernyataan pembeli nyata. Persentase
          = bagian persona simulasi yang berhasil dijalankan pada run ini.
        </p>
      </div>
    </Drawer>
  );
}
