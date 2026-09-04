"use client";

import { useEffect, useMemo, useState } from "react";

import { ErrorCard } from "@/components/ui/ErrorCard";
import type { CreativeFormatDto, CreativePackageDto } from "@/types/dashboard.types";
import type { ListingDto, ListingListDto } from "@/types/listing.types";

import styles from "./ManualBriefForm.module.css";

/**
 * The REAL `PropertyAdAngle` enum (`@aos/creative-agent`) — 8 members, in the design doc's/K1's
 * own declared order (`ALL_PROPERTY_AD_ANGLES`). No display-label precedent exists in any UI yet
 * (verified: `apps/aaos-simulator` and this dashboard's `listings`/`sosmed` components never
 * render `PropertyAdAngle` anywhere) — the raw enum member is shown, same as `ManualBriefForm.tsx`
 * already does for `AdAngle` and `Branch`.
 */
const PROPERTY_AD_ANGLES = [
  "DP_RINGAN",
  "READY_HUNI",
  "INVESTASI",
  "EXCLUSIVE",
  "SYARIAH",
  "PROMO_TERBATAS",
  "TESTIMONIAL",
  "VIRTUAL_TOUR",
] as const;

/** Mirrors `PropertyCreatePackageBodySchema.format` exactly. */
const FORMATS: ReadonlyArray<{ readonly id: CreativeFormatDto; readonly label: string }> = [
  { id: "VIDEO_AND_IMAGES", label: "Video + Gambar" },
  { id: "IMAGES_ONLY", label: "Gambar saja" },
];

const URGENCIES = ["HIGH", "MEDIUM", "LOW"] as const;

export interface PropertyManualBriefFormProps {
  readonly onCreated: (created: CreativePackageDto) => Promise<void> | void;
}

/**
 * PROPERTY tenants' "Buat Manual" tab (K4, `docs/PROMPT-AAOS-PROPERTY-CAMPAIGN-AND-CREATIVE.md`).
 *
 * A GENUINELY SEPARATE component from `ManualBriefForm.tsx`, not an `isProperty` branch inside it
 * — per K1's own committed reasoning ("the two verticals' real fields diverge almost completely":
 * no `unit`/`branch: Branch`/`AdAngle`/`targetPersona` equivalent exists on the PROPERTY side, and
 * the PROPERTY side adds a `listingId` picker with no AUTOMOTIVE equivalent). Threading both
 * shapes through one component's state would mean two parallel sets of state variables gated by a
 * single boolean throughout the whole file — strictly harder to read than two small, honest
 * components, and it matches the same separate-DTO/separate-endpoint decision K1 already made
 * server-side. `CreativeClient.tsx` picks between the two exactly once, at the tab render site,
 * the same shape as `Sidebar.tsx`'s own `isProperty` ternary convention.
 *
 * The listing picker reuses the REAL `GET /api/listings` route the Listing Manager page
 * (`ListingsClient.tsx`) already calls — no new listings-fetching mechanism.
 */
export function PropertyManualBriefForm({
  onCreated,
}: PropertyManualBriefFormProps): React.ReactElement {
  const [listings, setListings] = useState<readonly ListingDto[] | undefined>(undefined);
  const [listingsError, setListingsError] = useState<string | undefined>(undefined);
  const [listingId, setListingId] = useState<string>("");
  const [angle, setAngle] = useState<string>(PROPERTY_AD_ANGLES[0]);
  const [format, setFormat] = useState<CreativeFormatDto>("VIDEO_AND_IMAGES");
  const [urgency, setUrgency] = useState<string>("MEDIUM");
  const [primaryMessage, setPrimaryMessage] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    fetch("/api/listings?status=AKTIF")
      .then(async (res) => {
        if (!res.ok) throw new Error("Gagal memuat daftar listing.");
        return (await res.json()) as ListingListDto;
      })
      .then((body) => {
        if (!active) return;
        setListings(body.listings);
        setListingId((current) => (current === "" ? (body.listings[0]?.id ?? "") : current));
      })
      .catch((caught: unknown) => {
        if (active) {
          setListingsError(caught instanceof Error ? caught.message : "Gagal memuat listing.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedListing = useMemo(
    () => listings?.find((listing) => listing.id === listingId),
    [listings, listingId],
  );

  const canSubmit = listingId !== "" && !submitting;

  async function submit(generate: boolean): Promise<void> {
    setSubmitting(true);
    setError(undefined);
    try {
      const res = await fetch("/api/creative/property", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          listingId,
          angle,
          ...(primaryMessage.trim().length > 0 ? { primaryMessage: primaryMessage.trim() } : {}),
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
      <h3 className={styles.heading}>📝 Buat Brief Manual — Properti</h3>

      {listingsError !== undefined ? <ErrorCard message={listingsError} /> : null}
      {error !== undefined ? <ErrorCard message={error} /> : null}

      <label className={styles.field}>
        <span className={styles.label}>Listing *</span>
        <select
          className={styles.input}
          value={listingId}
          onChange={(event) => setListingId(event.target.value)}
          disabled={listings === undefined || listings.length === 0}
        >
          <option value="">— pilih listing —</option>
          {(listings ?? []).map((listing) => (
            <option key={listing.id} value={listing.id}>
              {listing.title} · {listing.propertyType} · {listing.photos.length} foto
            </option>
          ))}
        </select>
        {listings !== undefined && listings.length === 0 ? (
          <span data-testid="property-brief-no-listings" className={styles.hint}>
            Belum ada listing aktif. Tambahkan listing dulu di halaman “Listing Manager” sebelum
            membuat brief creative.
          </span>
        ) : null}
      </label>

      <div className={styles.field}>
        <span className={styles.label}>Foto listing yang akan dipakai Kai</span>
        {selectedListing === undefined ? (
          <span className={styles.hint}>Pilih listing dulu untuk melihat foto.</span>
        ) : selectedListing.photos.length === 0 ? (
          <span className={styles.hint}>
            Listing ini belum punya foto. Kai tetap bisa generate, tapi tanpa foto referensi
            (hasilnya murni AI). Unggah foto listing dulu di “Listing Manager” kalau mau foto
            aslinya dipakai.
          </span>
        ) : (
          <div data-testid="creative-photo-strip" className={styles.photoStrip}>
            {selectedListing.photos.map((photo) => (
              // eslint-disable-next-line @next/next/no-img-element -- see CreativePackageCard's note.
              <img key={photo.id} className={styles.photo} src={photo.url} alt="Foto listing" />
            ))}
          </div>
        )}
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Angle Kreatif *</span>
        <select
          className={styles.input}
          value={angle}
          onChange={(event) => setAngle(event.target.value)}
        >
          {PROPERTY_AD_ANGLES.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Pesan Utama</span>
        <input
          className={styles.input}
          value={primaryMessage}
          placeholder="DP mulai 10%, cicilan ringan"
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
          Kai yang memutuskan final: kalau listing ini tidak punya foto, “Video + Gambar” otomatis
          turun jadi “Gambar saja”.
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
              listingId,
              listingTitle: selectedListing?.title,
              angle,
              primaryMessage: primaryMessage.trim().length > 0 ? primaryMessage.trim() : undefined,
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
