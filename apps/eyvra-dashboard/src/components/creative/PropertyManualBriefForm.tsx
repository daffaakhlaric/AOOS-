"use client";

import { useEffect, useMemo, useState } from "react";

import { ErrorCard } from "@/components/ui/ErrorCard";
import {
  getFatigueRecommendation,
  recommendPropertyAngles,
  type AngleRecommendation,
} from "@/lib/kaiRecommendations";
import type {
  CreativeFormatDto,
  CreativePackageDto,
  PhotoAnalysisDto,
} from "@/types/dashboard.types";
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
 *
 * SPRINT 5 PROMPT 14 UPGRADE ("Brief ke Kai, versi sadar-heatmap"): this component IS the real
 * "Brief ke Kai" flow the spec asks to upgrade — the spec's literal file
 * (`components/creative/BriefKaiModal.tsx`, opened as a modal) does not exist anywhere in this
 * codebase; there is no modal at all. `CreativeHubClient.tsx`'s own docstring already documents the
 * real flow: the "Brief ke Kai ↗" header button navigates to `/creative?tab=review-kai`, which
 * renders `CreativeClient`'s "Buat Manual" tab — THIS component, for PROPERTY tenants. The 5-step
 * shape (listing → Kai recommendation → angle → format → preview/send) is built as real tab
 * content here rather than fabricating a second, parallel modal.
 *
 * STEP 2 "Kai merekomendasikan" — real, deterministic threshold logic (`recommendPropertyAngles`,
 * `src/lib/kaiRecommendations.ts`; see that module's own extensive docstring for the honest
 * data-availability finding that shaped its exact scope: no real join exists between an audience
 * segment and a creative angle anywhere in this codebase, so recommendations are built from the
 * real signal that DOES exist — how many OTHER real listings already used + got a human approval
 * for a given angle). Fetches the SAME real `GET /api/creative?limit=200` endpoint
 * `CreativeClient.tsx` already calls — no second/new endpoint.
 *
 * STEP 5 "Prediksi performa": the spec asks for "CTR rata-rata Z% dari Y aset sejenis". No real
 * field anywhere joins a `CreativePackageDto.angle` to a CTR/impressions value (heatmap CTR is
 * grouped by creative ASSET, never by angle — same gap `kaiRecommendations.ts` documents). Rather
 * than fabricate a CTR number, this honestly shows why it is unavailable instead.
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

  // Step 2 — Kai's real recommendation data + which recommendation(s) the user has accepted.
  const [allPackages, setAllPackages] = useState<readonly CreativePackageDto[] | undefined>(
    undefined,
  );
  const [acceptedAngles, setAcceptedAngles] = useState<ReadonlySet<string>>(new Set());
  const [manuallyPickedAngle, setManuallyPickedAngle] = useState(false);

  // Kai Creative Engine Sprint 4 — real, on-demand, per-photo Vision analysis (Sprint 1/2's
  // LlmService.analyzePropertyPhoto via the new /api/creative/photo-analysis proxy). Keyed by
  // photo id; "loading" while a call is in flight, the real PhotoAnalysisDto once it resolves.
  const [photoAnalysis, setPhotoAnalysis] = useState<Record<string, PhotoAnalysisDto | "loading">>(
    {},
  );

  async function analyzePhoto(photoId: string, photoUrl: string): Promise<void> {
    setPhotoAnalysis((current) => ({ ...current, [photoId]: "loading" }));
    try {
      const res = await fetch("/api/creative/photo-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ photoUrl }),
      });
      const body = (await res.json()) as PhotoAnalysisDto | { error: { message: string } };
      const result: PhotoAnalysisDto =
        "available" in body
          ? body
          : { available: false, reason: "PROVIDER_ERROR", message: body.error.message };
      setPhotoAnalysis((current) => ({ ...current, [photoId]: result }));
    } catch {
      setPhotoAnalysis((current) => ({
        ...current,
        [photoId]: { available: false, reason: "PROVIDER_ERROR", message: "Gagal analisa foto." },
      }));
    }
  }

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

  // Real data for Step 2's recommendation cards — the SAME `/api/creative` list `CreativeClient`
  // already fetches, read once here (best-effort: a failure just means no recommendations show,
  // never breaks the rest of the form).
  useEffect(() => {
    let active = true;
    fetch("/api/creative?limit=200")
      .then(async (res) =>
        res.ok ? ((await res.json()) as { packages: readonly CreativePackageDto[] }) : undefined,
      )
      .then((body) => {
        if (active && body !== undefined) {
          setAllPackages(body.packages);
        }
      })
      .catch(() => {
        // Best-effort only — Step 2 simply shows no cards, same discipline as other best-effort
        // fetches in this file.
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedListing = useMemo(
    () => listings?.find((listing) => listing.id === listingId),
    [listings, listingId],
  );

  const recommendations: readonly AngleRecommendation[] = useMemo(() => {
    if (allPackages === undefined || listingId === "") {
      return [];
    }
    return recommendPropertyAngles(allPackages, listingId, PROPERTY_AD_ANGLES);
  }, [allPackages, listingId]);

  // AAOS LOOP UPGRADE, Sprint 6 Prompt 16 — real fatigue-aware recommendation for THIS listing,
  // rendered with the highest priority (above the angle-recommendation cards) per the spec's own
  // explicit instruction.
  const fatigueRecommendation = useMemo(() => {
    if (allPackages === undefined || listingId === "") {
      return undefined;
    }
    return getFatigueRecommendation(allPackages, listingId);
  }, [allPackages, listingId]);

  const recommendedAngleSet = useMemo(
    () => new Set(recommendations.map((rec) => rec.angle)),
    [recommendations],
  );

  // Pre-select the first TINGGI-confidence recommendation's angle automatically (per spec: "angle
  // yang direkomendasikan Step 2 sudah pre-selected") — but only until the user has manually
  // touched the angle picker themselves, so this never overrides a deliberate choice.
  useEffect(() => {
    if (manuallyPickedAngle) {
      return;
    }
    const highConfidence = recommendations.find((rec) => rec.preChecked);
    if (highConfidence !== undefined) {
      setAngle(highConfidence.angle);
      setAcceptedAngles((current) => new Set(current).add(highConfidence.angle));
    }
  }, [recommendations, manuallyPickedAngle]);

  function toggleRecommendation(rec: AngleRecommendation, checked: boolean): void {
    setAcceptedAngles((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(rec.angle);
      } else {
        next.delete(rec.angle);
      }
      return next;
    });
    if (checked) {
      setManuallyPickedAngle(true);
      setAngle(rec.angle);
      // Real, persisted record of WHY this angle was picked (the only genuinely available field —
      // see this file's own docstring on why a fabricated "AI Suggested" flag is not added
      // anywhere it cannot be honestly persisted).
      setReason((current) => (current.trim().length > 0 ? current : rec.reasoning));
    }
  }

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
          // Real, honest record of whether the angle actually being submitted is one the manager
          // accepted as a Kai recommendation (Step 2's checkbox state) — NOT whether a
          // recommendation merely existed for some other angle. `042_creative_packages_ai_recommended.sql`.
          aiRecommended: acceptedAngles.has(angle),
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
            {selectedListing.photos.map((photo) => {
              const analysis = photoAnalysis[photo.id];
              return (
                <div key={photo.id} className={styles.photoStripItem}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- see CreativePackageCard's note. */}
                  <img className={styles.photo} src={photo.url} alt="Foto listing" />
                  {analysis === undefined ? (
                    <button
                      type="button"
                      className={styles.photoAnalyzeButton}
                      onClick={() => void analyzePhoto(photo.id, photo.url)}
                    >
                      🔍 Analisa Foto
                    </button>
                  ) : analysis === "loading" ? (
                    <span className={styles.hint}>Menganalisa…</span>
                  ) : analysis.available ? (
                    <span
                      data-testid={`photo-analysis-${photo.id}`}
                      className={styles.photoAnalysisBadge}
                    >
                      {analysis.scene} · {analysis.recommendedUse} · skor {analysis.marketingScore}
                    </span>
                  ) : (
                    <span className={styles.hint}>{analysis.message}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {fatigueRecommendation !== undefined ? (
        <div
          className={`${styles.recommendationCard} ${styles.fatigueRecommendationCard}`}
          data-testid="fatigue-recommendation-card"
        >
          <div className={styles.recommendationBody}>
            <div className={styles.recommendationHead}>
              <strong>
                {fatigueRecommendation.fatigueStatus === "FATIGUED" ? "⚠ Fatigue" : "Menurun"}
              </strong>
            </div>
            <p className={styles.recommendationReason}>{fatigueRecommendation.reasoning}</p>
          </div>
        </div>
      ) : null}

      {listingId !== "" && recommendations.length > 0 ? (
        <div className={styles.field} data-testid="kai-recommendations">
          <span className={styles.label}>💡 Kai merekomendasikan</span>
          <span className={styles.hint}>berdasarkan riwayat approval brief 30 hari terakhir</span>
          <div className={styles.recommendationList}>
            {recommendations.map((rec) => (
              <label key={rec.angle} className={styles.recommendationCard}>
                <input
                  type="checkbox"
                  checked={acceptedAngles.has(rec.angle)}
                  onChange={(event) => toggleRecommendation(rec, event.target.checked)}
                />
                <div className={styles.recommendationBody}>
                  <div className={styles.recommendationHead}>
                    <strong>{rec.angle}</strong>
                    <span
                      data-testid={`confidence-badge-${rec.angle}`}
                      className={`${styles.confidenceBadge} ${
                        rec.confidence === "TINGGI"
                          ? styles.confidenceHigh
                          : rec.confidence === "SEDANG"
                            ? styles.confidenceMedium
                            : styles.confidenceLow
                      }`}
                    >
                      {rec.confidence === "TINGGI"
                        ? "Tinggi"
                        : rec.confidence === "SEDANG"
                          ? "Sedang"
                          : "Coba-coba"}
                    </span>
                  </div>
                  <p className={styles.recommendationReason}>{rec.reasoning}</p>
                  <span className={styles.hint}>Pakai rekomendasi ini</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {/* A plain `<div>`, not `<label>` — a `<label>` wrapping `<button>` elements (a real
          "labelable" HTML element) implicitly associates with the FIRST button inside it,
          silently prepending "Angle Kreatif *" into ONLY that first button's real accessible
          name. `FORMAT`/`URGENCY` below already use `<div>` for this exact reason. */}
      <div className={styles.field}>
        <span className={styles.label}>Angle Kreatif *</span>
        <div className={styles.pillRow}>
          {PROPERTY_AD_ANGLES.map((entry) => (
            <button
              key={entry}
              type="button"
              className={angle === entry ? `${styles.pill} ${styles.pillActive}` : styles.pill}
              aria-pressed={angle === entry}
              onClick={() => {
                setManuallyPickedAngle(true);
                setAngle(entry);
              }}
            >
              {entry}
              {recommendedAngleSet.has(entry) ? (
                <span className={styles.recommendedTag}>Direkomendasikan</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

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
        {/*
         * Step 5's "Prediksi performa: berdasarkan Y aset sejenis, CTR rata-rata Z%" — honestly
         * NOT computable: no real field anywhere joins `angle` to a CTR/impressions value (the real
         * heatmap CTR data is grouped by creative ASSET, `HeatmapCellDto.assetId`, never by angle —
         * same finding `src/lib/kaiRecommendations.ts`'s own docstring documents in depth). Rather
         * than fabricate a Y/Z number, this line says so.
         */}
        <p className={styles.hint} data-testid="performance-prediction-honest-note">
          Prediksi performa belum tersedia — tidak ada data CTR historis yang bisa dikaitkan dengan
          angle secara real (heatmap performa dikelompokkan per creative asset, bukan per angle).
        </p>
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
