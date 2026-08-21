"use client";

import { useEffect, useState } from "react";

import type { CreativeFormatDto, ScrapedUnitDto, StockListDto } from "@/types/dashboard.types";

import styles from "./CreateAbTestModal.module.css";

/** The REAL `Branch` enum (`@aos/meta-ads-connector`) — same list `ManualBriefForm.tsx` already uses. */
const BRANCHES = ["CINERE", "BINTARO", "BANDUNG", "JABODETABEK", "BOOST", "MULTI", "UMUM"] as const;

const FORMATS: ReadonlyArray<{ readonly id: CreativeFormatDto; readonly label: string }> = [
  { id: "VIDEO_AND_IMAGES", label: "Video + Gambar" },
  { id: "IMAGES_ONLY", label: "Gambar saja" },
];

export interface CreateAbTestModalProps {
  readonly onClose: () => void;
  readonly onCreated: () => void;
}

/**
 * "+ Buat A/B Test Baru" modal (AAOS-ABTESTING-LOOKALIKE) — Mode Auto only, per
 * `CreateAbTestBodySchema`'s own documented scope (Mode Manual is a backend deferral, not hidden
 * here without explanation — see the note under the mode row below).
 *
 * Reuses the SAME real scraped-stock unit picker (`GET /api/scraper/stock`) `ManualBriefForm.tsx`
 * already uses — Tamara's auto-generated variants are real `CreativePackagesService.create()`
 * calls under the hood, needing the exact same `unit`/`branch` fields a manual brief does.
 */
export function CreateAbTestModal({
  onClose,
  onCreated,
}: CreateAbTestModalProps): React.ReactElement {
  const [units, setUnits] = useState<readonly ScrapedUnitDto[] | undefined>(undefined);
  const [unitId, setUnitId] = useState("");
  const [branch, setBranch] = useState<string>(BRANCHES[0]);
  const [name, setName] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [adSetId, setAdSetId] = useState("");
  const [pageId, setPageId] = useState("");
  const [waLink, setWaLink] = useState("");
  const [variantCount, setVariantCount] = useState<2 | 3>(2);
  const [primaryMessage, setPrimaryMessage] = useState("");
  const [format, setFormat] = useState<CreativeFormatDto>("VIDEO_AND_IMAGES");
  const [thresholdSpend, setThresholdSpend] = useState(100_000);
  const [thresholdDays, setThresholdDays] = useState(3);
  const [minMarginPct, setMinMarginPct] = useState(20);
  const [autoPauseLoser, setAutoPauseLoser] = useState(true);
  const [autoScaleWinner, setAutoScaleWinner] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    fetch("/api/scraper/stock?available=true&limit=200")
      .then(async (res) => {
        if (!res.ok) throw new Error("Gagal memuat stok unit.");
        return (await res.json()) as StockListDto;
      })
      .then((body) => {
        if (!active) return;
        setUnits(body.units);
        const first = body.units[0];
        if (first !== undefined) {
          setUnitId(first.unitId);
          setBranch(first.branch);
        }
      })
      .catch(() => {
        if (active) setUnits([]);
      });
    return () => {
      active = false;
    };
  }, []);

  function validate(): string | undefined {
    if (name.trim().length === 0) return "Nama test wajib diisi.";
    if (campaignId.trim().length === 0) return "Campaign ID wajib diisi.";
    if (adSetId.trim().length === 0) return "Ad Set ID wajib diisi.";
    if (pageId.trim().length === 0) return "Page ID wajib diisi.";
    if (waLink.trim().length === 0) return "Link WhatsApp wajib diisi.";
    if (unitId === "") return "Pilih unit yang akan di-test.";
    if (primaryMessage.trim().length === 0) return "Pesan utama wajib diisi.";
    return undefined;
  }

  async function handleSubmit(): Promise<void> {
    const validationError = validate();
    if (validationError !== undefined) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      const response = await fetch("/api/abtesting", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          campaignId: campaignId.trim(),
          adSetId: adSetId.trim(),
          pageId: pageId.trim(),
          waLink: waLink.trim(),
          mode: "AUTO",
          variantCount,
          unit: unitId,
          branch,
          primaryMessage: primaryMessage.trim(),
          format,
          thresholdSpend,
          thresholdDays,
          minMarginPct,
          autoPauseLoser,
          autoScaleWinner,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Gagal membuat A/B test.");
      }
      onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal membuat A/B test.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Buat A/B Test Baru">
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>+ Buat A/B Test Baru</span>
          <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Tutup">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.modeNote}>
            Mode: <strong>Auto</strong> — Tamara buat variasi angle/copy otomatis dari brief di
            bawah. (Mode Manual — memilih creative yang sudah ada — belum tersedia di halaman ini.)
          </p>

          <div className={styles.formGroup}>
            <label htmlFor="abt-name" className={styles.formLabel}>
              Nama Test *
            </label>
            <input
              id="abt-name"
              className={styles.formInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Xpander Cinere — DP vs Stok"
            />
          </div>

          <div className={styles.formRow}>
            <label className={styles.formGroup}>
              <span className={styles.formLabel}>Campaign ID (Meta) *</span>
              <input
                className={styles.formInput}
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                placeholder="120000000000099"
              />
            </label>
            <label className={styles.formGroup}>
              <span className={styles.formLabel}>Ad Set ID (Meta) *</span>
              <input
                className={styles.formInput}
                value={adSetId}
                onChange={(e) => setAdSetId(e.target.value)}
                placeholder="120000000000100"
              />
            </label>
          </div>

          <div className={styles.formRow}>
            <label className={styles.formGroup}>
              <span className={styles.formLabel}>Page ID (Facebook) *</span>
              <input
                className={styles.formInput}
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
              />
            </label>
            <label className={styles.formGroup}>
              <span className={styles.formLabel}>Link WhatsApp (untuk creative Gambar) *</span>
              <input
                className={styles.formInput}
                value={waLink}
                onChange={(e) => setWaLink(e.target.value)}
                placeholder="https://wa.me/6281234567890"
              />
            </label>
          </div>

          <label className={styles.formGroup}>
            <span className={styles.formLabel}>Unit yang akan di-test (dari stok Mobix) *</span>
            <select
              className={styles.formInput}
              value={unitId}
              onChange={(e) => {
                setUnitId(e.target.value);
                const selected = units?.find((u) => u.unitId === e.target.value);
                if (selected !== undefined) setBranch(selected.branch);
              }}
            >
              <option value="">— pilih unit —</option>
              {(units ?? []).map((unit) => (
                <option key={unit.unitId} value={unit.unitId}>
                  {unit.model} {unit.year} · {unit.branch}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.formGroup}>
            <span className={styles.formLabel}>Jumlah Variasi</span>
            <div className={styles.pillRow}>
              {([2, 3] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  className={
                    variantCount === count ? `${styles.pill} ${styles.pillActive}` : styles.pill
                  }
                  aria-pressed={variantCount === count}
                  onClick={() => setVariantCount(count)}
                >
                  {count} variasi
                </button>
              ))}
            </div>
          </div>

          <label className={styles.formGroup}>
            <span className={styles.formLabel}>Pesan Utama *</span>
            <input
              className={styles.formInput}
              value={primaryMessage}
              onChange={(e) => setPrimaryMessage(e.target.value)}
              placeholder="DP mulai 29 juta, cicilan 5 jutaan"
            />
          </label>

          <div className={styles.formGroup}>
            <span className={styles.formLabel}>Format Creative</span>
            <div className={styles.pillRow}>
              {FORMATS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={
                    format === entry.id ? `${styles.pill} ${styles.pillActive}` : styles.pill
                  }
                  aria-pressed={format === entry.id}
                  onClick={() => setFormat(entry.id)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>

          <p className={styles.sectionTitle}>Threshold</p>
          <div className={styles.formRow}>
            <label className={styles.formGroup}>
              <span className={styles.formLabel}>Min spend (Rp)</span>
              <input
                type="number"
                className={styles.formInputSmall}
                value={thresholdSpend}
                onChange={(e) => setThresholdSpend(Number(e.target.value))}
              />
            </label>
            <label className={styles.formGroup}>
              <span className={styles.formLabel}>Atau min hari berjalan</span>
              <input
                type="number"
                className={styles.formInputSmall}
                value={thresholdDays}
                onChange={(e) => setThresholdDays(Number(e.target.value))}
              />
            </label>
            <label className={styles.formGroup}>
              <span className={styles.formLabel}>Selisih Rp/lead min (%)</span>
              <input
                type="number"
                className={styles.formInputSmall}
                value={minMarginPct}
                onChange={(e) => setMinMarginPct(Number(e.target.value))}
              />
            </label>
          </div>

          <div className={styles.formGroup}>
            <span className={styles.formLabel}>Aksi otomatis setelah winner</span>
            <div className={styles.checkboxRow}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={autoPauseLoser}
                  onChange={(e) => setAutoPauseLoser(e.target.checked)}
                />
                Pause loser otomatis
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={autoScaleWinner}
                  onChange={(e) => setAutoScaleWinner(e.target.checked)}
                />
                Scale winner +20%
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
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            {submitting ? "Memulai..." : "🔬 Mulai A/B Test"}
          </button>
        </div>
      </div>
    </div>
  );
}
