"use client";
import { useState } from "react";
import { Card } from "@/components/common/Card";
import { Drawer } from "@/components/common/Drawer";
import { presentLabel } from "@/lib/presentation";
import {
  composeKaiBrief,
  type StressTestEvaluatedResultDto,
  type StressTestRunDto,
} from "@/lib/stress-test";
import { buildKnowledgeGaps, parseKaiBriefSections } from "@/lib/stress-test-result";
import { EvidenceBadge } from "./EvidenceBadge";
import styles from "./result.module.css";

const KAI_ANGLES = [
  "DP_RINGAN",
  "READY_HUNI",
  "INVESTASI",
  "EXCLUSIVE",
  "SYARIAH",
  "PROMO_TERBATAS",
  "TESTIMONIAL",
  "VIRTUAL_TOUR",
];

/** Which real route carries the "Kirim ke Kai" submission for this run's real `sourceType`. */
type KaiBriefTarget =
  | { readonly kind: "CAMPAIGN"; readonly campaignId: string }
  | { readonly kind: "LISTING"; readonly runId: string }
  | { readonly kind: "UNSUPPORTED" };

function resolveKaiBriefTarget(run: StressTestRunDto): KaiBriefTarget {
  if (run.sourceType === "CAMPAIGN" && run.campaignId !== undefined) {
    return { kind: "CAMPAIGN", campaignId: run.campaignId };
  }
  if (run.sourceType === "LISTING" && run.listingId !== undefined) {
    return { kind: "LISTING", runId: run.id };
  }
  return { kind: "UNSUPPORTED" };
}

/** Read-only preview of the real Pertahankan/Ubah/Hindari sections `composeKaiBrief` produces,
 * plus the "Butuh bukti dulu" knowledge-gap list from real unsupported / unverifiable claims. */
function KaiBriefPreview({
  result,
}: {
  readonly result: StressTestEvaluatedResultDto;
}): React.ReactElement {
  const sections = parseKaiBriefSections(composeKaiBrief(result));
  const gaps = buildKnowledgeGaps(result);
  return (
    <div data-testid="stress-test-kai-preview">
      {sections.map((s) => (
        <div key={s.heading} style={{ marginBottom: 8 }}>
          <span className={styles.sectionLabel}>{s.heading}</span>
          <ul className={styles.plainList}>
            {s.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ))}
      {gaps.length > 0 ? (
        <div style={{ marginBottom: 8 }} data-testid="stress-test-kai-knowledge-gaps">
          <div className={styles.badgeRow}>
            <span className={styles.sectionLabel}>Butuh bukti dulu</span>
            <EvidenceBadge kind="UNVERIFIED" />
          </div>
          <ul className={styles.plainList}>
            {gaps.map((g) => (
              <li key={g.id}>{g.text}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * "Kirim ke Kai" revision handoff. `sourceType === "CAMPAIGN"` reuses the EXISTING
 * `/api/campaigns/[campaignId]/brief` route as-is (no duplicated logic); `sourceType === "LISTING"`
 * calls `/api/creative-stress-test/[id]/send-to-kai`. Angle and format are NEVER defaulted — the
 * real `StressTestRunDto` never carries the tested creative's own angle/format, so both selects
 * always start unselected and required. Submit paths are unchanged from the previous result page;
 * only the card now also shows a read-only preview of the brief.
 */
export function SendToKaiPanel({
  run,
  result,
}: {
  readonly run: StressTestRunDto;
  readonly result: StressTestEvaluatedResultDto;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [angle, setAngle] = useState("");
  const [format, setFormat] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeIsError, setNoticeIsError] = useState(false);

  const target = resolveKaiBriefTarget(run);

  function openDrawer(): void {
    setMessage(composeKaiBrief(result));
    setAngle("");
    setFormat("");
    setNotice("");
    setNoticeIsError(false);
    setOpen(true);
  }

  async function submit(): Promise<void> {
    if (target.kind === "UNSUPPORTED") return;
    setSaving(true);
    setNotice("");
    setNoticeIsError(false);
    try {
      const url =
        target.kind === "CAMPAIGN"
          ? `/api/campaigns/${encodeURIComponent(target.campaignId)}/brief`
          : `/api/creative-stress-test/${encodeURIComponent(target.runId)}/send-to-kai`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ angle, message, format }),
      });
      const responseBody = (await r.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!r.ok) throw new Error(responseBody.error?.message ?? "Brief gagal disimpan");
      setNotice("Brief tersimpan sebagai Draft di Kai. Belum ada generation atau publikasi iklan.");
      setNoticeIsError(false);
    } catch (e) {
      setNoticeIsError(true);
      setNotice(e instanceof Error ? e.message : "Brief gagal disimpan");
    } finally {
      setSaving(false);
    }
  }

  if (target.kind === "UNSUPPORTED") {
    return (
      <Card title="Kirim ke Kai" variant="compact" testId="stress-test-send-to-kai-card">
        <p className={styles.muted}>
          Handoff ke Kai belum didukung untuk sumber run ini ({presentLabel(run.sourceType)}) —
          belum ada listing atau campaign nyata yang terhubung ke run ini.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Kirim ke Kai" variant="compact" testId="stress-test-send-to-kai-card">
      <p className={styles.muted} style={{ marginBottom: 8 }}>
        Brief revisi disusun dari hasil evaluasi nyata run ini — tersimpan sebagai Draft, bukan
        generation otomatis.
      </p>
      <KaiBriefPreview result={result} />
      <button
        type="button"
        className={styles.buttonPrimary}
        data-testid="stress-test-send-to-kai-button"
        onClick={openDrawer}
      >
        Kirim ke Kai
      </button>
      <Drawer
        open={open}
        onClose={() => {
          if (!saving) setOpen(false);
        }}
        title="Kirim revisi ke Kai"
      >
        <p>
          Brief di bawah disusun otomatis dari hasil evaluasi nyata run ini — tinjau dan edit
          sebelum dikirim. Brief akan tersimpan sebagai Draft; generation dan publikasi iklan
          dijalankan terpisah.
        </p>
        <div className={styles.kaiForm}>
          <label>
            Angle
            <select
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              data-testid="stress-test-kai-angle"
            >
              <option value="">Pilih angle…</option>
              {KAI_ANGLES.map((a) => (
                <option key={a} value={a}>
                  {presentLabel(a)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Format
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              data-testid="stress-test-kai-format"
            >
              <option value="">Pilih format…</option>
              <option value="IMAGES_ONLY">Images</option>
              <option value="VIDEO_AND_IMAGES">Video + images</option>
            </select>
          </label>
          <label>
            Brief revisi
            <textarea
              value={message}
              maxLength={2000}
              rows={8}
              onChange={(e) => setMessage(e.target.value)}
              data-testid="stress-test-kai-message"
            />
          </label>
          <button
            type="button"
            disabled={saving || !angle || !format || !message.trim()}
            onClick={() => void submit()}
            data-testid="stress-test-kai-submit"
          >
            {saving ? "Mengirim…" : "Kirim brief ke Kai"}
          </button>
          {notice ? <p role={noticeIsError ? "alert" : "status"}>{notice}</p> : null}
        </div>
      </Drawer>
    </Card>
  );
}
