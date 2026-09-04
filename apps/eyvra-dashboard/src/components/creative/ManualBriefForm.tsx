"use client";

import { useEffect, useMemo, useState } from "react";

import { ErrorCard } from "@/components/ui/ErrorCard";
import type {
  AssetListDto,
  CreativeFormatDto,
  CreativePackageDto,
  ScrapedUnitDto,
  StockListDto,
} from "@/types/dashboard.types";

import styles from "./ManualBriefForm.module.css";

/** The REAL `AdAngle` enum (`@aos/meta-ads-agent`) — 7 members, including `WEBSITE_REDIRECT`. There is no `PROMO` member anywhere in this codebase. */
const AD_ANGLES = [
  "DP_RINGAN",
  "KREDIT_SYARIAH",
  "GUDANGNYA",
  "QNA",
  "DISCOVERY",
  "TESTIMONIAL",
  "WEBSITE_REDIRECT",
] as const;

/** The REAL `Branch` enum (`@aos/meta-ads-connector`). */
const BRANCHES = ["CINERE", "BINTARO", "BANDUNG", "JABODETABEK", "BOOST", "MULTI", "UMUM"] as const;

/** The REAL `TargetPersona` enum (`@aos/meta-ads-agent`) — two members, not a free-text persona. */
const PERSONAS = [
  { id: "PRIMARY_FAMILY", label: "Keluarga (primary)" },
  { id: "SECONDARY_BUSINESS", label: "Usaha / niaga (secondary)" },
] as const;

/**
 * The REAL `CreativeFormat` (`@aos/creative-agent`) — a package-level, two-value decision, not a
 * per-asset multi-select. Kai's own `FormatDecider` may still downgrade `VIDEO_AND_IMAGES` to
 * `IMAGES_ONLY` when the unit has no source photos; that real outcome is shown on the package
 * afterwards.
 */
const FORMATS: ReadonlyArray<{ readonly id: CreativeFormatDto; readonly label: string }> = [
  { id: "VIDEO_AND_IMAGES", label: "Video + Gambar" },
  { id: "IMAGES_ONLY", label: "Gambar saja" },
];

const URGENCIES = ["HIGH", "MEDIUM", "LOW"] as const;

export interface ManualBriefFormProps {
  readonly onCreated: (created: CreativePackageDto) => Promise<void> | void;
}

/**
 * "Buat Manual" — a manager composes a brief by hand.
 *
 * The unit is picked from the REAL scraped stock (`GET /api/scraper/stock`) rather than typed as
 * free text, and the value submitted is the unit's `unitId` (its `identityKey`). That is
 * load-bearing, not cosmetic: `@aos/creative-agent` finds source photos by calling
 * `GetAssetsByUnit({ unitId: brief.unit })`, which matches `assets.unit_id` exactly — so a
 * free-text unit name would silently yield zero photos. Because the same key is used, the photo
 * strip below shows exactly the photos Kai will really see.
 *
 * NOT BUILT, deliberately: the spec's "Upload foto sendiri" button. `POST /api/v1/assets/upload`
 * does not exist and this Fastify app registers no multipart parser, so a real upload is new
 * backend scope. A button that looked functional but wasn't would be worse than its absence.
 */
export function ManualBriefForm({ onCreated }: ManualBriefFormProps): React.ReactElement {
  const [units, setUnits] = useState<readonly ScrapedUnitDto[] | undefined>(undefined);
  const [unitsError, setUnitsError] = useState<string | undefined>(undefined);
  const [unitId, setUnitId] = useState<string>("");
  const [branch, setBranch] = useState<string>(BRANCHES[0]);
  const [angle, setAngle] = useState<string>(AD_ANGLES[0]);
  const [targetPersona, setTargetPersona] = useState<string>(PERSONAS[0].id);
  const [format, setFormat] = useState<CreativeFormatDto>("VIDEO_AND_IMAGES");
  const [urgency, setUrgency] = useState<string>("MEDIUM");
  const [primaryMessage, setPrimaryMessage] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [photos, setPhotos] = useState<readonly string[] | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    fetch("/api/scraper/stock?available=true&limit=200")
      .then(async (res) => {
        if (!res.ok) throw new Error("Gagal memuat stok unit dari scraper.");
        return (await res.json()) as StockListDto;
      })
      .then((body) => {
        if (!active) return;
        setUnits(body.units);
        setUnitId((current) => (current === "" ? (body.units[0]?.unitId ?? "") : current));
      })
      .catch((caught: unknown) => {
        if (active) {
          setUnitsError(caught instanceof Error ? caught.message : "Gagal memuat stok unit.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedUnit = useMemo(
    () => units?.find((unit) => unit.unitId === unitId),
    [units, unitId],
  );

  // Real preview of the photos Kai will find — the SAME `unit_id` key `GetAssetsByUnit` matches on.
  useEffect(() => {
    if (unitId === "") {
      setPhotos(undefined);
      return;
    }
    let active = true;
    setPhotos(undefined);
    fetch(`/api/assets?type=UNIT_PHOTO&status=ACTIVE&limit=12&unitId=${encodeURIComponent(unitId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("gagal");
        return (await res.json()) as AssetListDto;
      })
      .then((body) => {
        if (active) setPhotos(body.assets.map((asset) => asset.publicUrl));
      })
      .catch(() => {
        if (active) setPhotos([]);
      });
    return () => {
      active = false;
    };
  }, [unitId]);

  useEffect(() => {
    if (selectedUnit !== undefined) {
      setBranch(selectedUnit.branch);
    }
  }, [selectedUnit]);

  const canSubmit = unitId !== "" && primaryMessage.trim().length > 0 && !submitting;

  async function submit(generate: boolean): Promise<void> {
    setSubmitting(true);
    setError(undefined);
    try {
      const res = await fetch("/api/creative", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          unit: unitId,
          ...(selectedUnit !== undefined
            ? { unitModel: `${selectedUnit.model} ${String(selectedUnit.year)}` }
            : {}),
          branch,
          angle,
          targetPersona,
          primaryMessage: primaryMessage.trim(),
          format,
          urgency,
          origin: "MANUAL",
          ...(reason.trim().length > 0 ? { reason: reason.trim() } : {}),
          generate,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Gagal menyimpan brief.");
      }
      const body = (await res.json()) as { package: CreativePackageDto };
      setPrimaryMessage("");
      setReason("");
      await onCreated(body.package);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menyimpan brief.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.card}>
      <h3 className={styles.heading}>📝 Buat Brief Manual</h3>

      {unitsError !== undefined ? <ErrorCard message={unitsError} /> : null}
      {error !== undefined ? <ErrorCard message={error} /> : null}

      <label className={styles.field}>
        <span className={styles.label}>Unit Mobil (dari stok Mobix) *</span>
        <select
          className={styles.input}
          value={unitId}
          onChange={(event) => setUnitId(event.target.value)}
        >
          <option value="">— pilih unit —</option>
          {(units ?? []).map((unit) => (
            <option key={unit.unitId} value={unit.unitId}>
              {unit.model} {unit.year} · {unit.branch} · {unit.photoCount} foto
            </option>
          ))}
        </select>
        {units !== undefined && units.length === 0 ? (
          <span className={styles.hint}>
            Belum ada unit hasil scraping. Jalankan scraper dulu di halaman “Scraper Mobix”.
          </span>
        ) : null}
      </label>

      <div className={styles.field}>
        <span className={styles.label}>Foto unit yang akan dipakai Kai</span>
        {photos === undefined ? (
          <span className={styles.hint}>Memuat foto…</span>
        ) : photos.length === 0 ? (
          <span className={styles.hint}>
            Belum ada foto unit ini di asset library. Kai tetap bisa generate, tapi tanpa foto
            referensi (hasilnya murni AI). Jalankan scraper untuk unit ini dulu kalau mau foto
            aslinya dipakai.
          </span>
        ) : (
          <div data-testid="creative-photo-strip" className={styles.photoStrip}>
            {photos.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element -- see CreativePackageCard's note.
              <img key={url} className={styles.photo} src={url} alt="Foto unit dari stok Mobix" />
            ))}
          </div>
        )}
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Cabang *</span>
        <select
          className={styles.input}
          value={branch}
          onChange={(event) => setBranch(event.target.value)}
        >
          {BRANCHES.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Angle Kreatif *</span>
        <select
          className={styles.input}
          value={angle}
          onChange={(event) => setAngle(event.target.value)}
        >
          {AD_ANGLES.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Target Persona *</span>
        <select
          className={styles.input}
          value={targetPersona}
          onChange={(event) => setTargetPersona(event.target.value)}
        >
          {PERSONAS.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Pesan Utama *</span>
        <input
          className={styles.input}
          value={primaryMessage}
          placeholder="DP mulai 29 juta, cicilan 5 jutaan"
          onChange={(event) => setPrimaryMessage(event.target.value)}
        />
      </label>

      <div className={styles.field}>
        <span className={styles.label}>Format Creative *</span>
        <div className={styles.pillRow}>
          {FORMATS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={format === entry.id ? `${styles.pill} ${styles.pillActive}` : styles.pill}
              aria-pressed={format === entry.id}
              onClick={() => setFormat(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <span className={styles.hint}>
          Kai yang memutuskan final: kalau unit ini tidak punya foto sumber, “Video + Gambar”
          otomatis turun jadi “Gambar saja”.
        </span>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Urgensi</span>
        <div className={styles.pillRow}>
          {URGENCIES.map((entry) => (
            <button
              key={entry}
              type="button"
              className={urgency === entry ? `${styles.pill} ${styles.pillActive}` : styles.pill}
              aria-pressed={urgency === entry}
              onClick={() => setUrgency(entry)}
            >
              {entry}
            </button>
          ))}
        </div>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Alasan / catatan</span>
        <input
          className={styles.input}
          value={reason}
          placeholder="Kenapa creative ini dibuat"
          onChange={(event) => setReason(event.target.value)}
        />
      </label>

      <div className={styles.field}>
        <span className={styles.label}>Brief yang akan dikirim ke Kai</span>
        <pre data-testid="creative-brief-preview" className={styles.preview}>
          {JSON.stringify(
            {
              unit: unitId,
              unitModel:
                selectedUnit !== undefined
                  ? `${selectedUnit.model} ${String(selectedUnit.year)}`
                  : undefined,
              branch,
              angle,
              targetPersona,
              primaryMessage: primaryMessage.trim(),
              format,
              urgency,
            },
            null,
            2,
          )}
        </pre>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={!canSubmit}
          onClick={() => void submit(true)}
        >
          🚀 Kirim ke Kai — Generate Sekarang
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={!canSubmit}
          onClick={() => void submit(false)}
        >
          📋 Simpan sebagai Draft
        </button>
      </div>
      <span className={styles.hint}>
        “Generate Sekarang” memakai kredit Kie AI sungguhan. “Simpan Draft” tidak memanggil apa pun.
      </span>
    </section>
  );
}
