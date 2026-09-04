"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  formatListingPrice,
  LISTING_STATUSES,
  type ListingDto,
  type ListingStatus,
} from "@/types/listing.types";

import styles from "./ListingDetailClient.module.css";

async function parseError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  return body.error?.message ?? fallback;
}

/**
 * `/listings/:id` — Listing Detail page (spec Part 4). Split 60/40: left = foto gallery + specs +
 * deskripsi; right = actions (`🎨 Buat Creative dengan Kai →`, `📚 Jadikan Knowledge Samantha`,
 * `📋 Copy detail untuk WA`, toggle status AKTIF/TERJUAL/DRAFT).
 */
export function ListingDetailClient({
  listingId,
}: {
  readonly listingId: string;
}): React.ReactElement {
  const router = useRouter();
  const [listing, setListing] = useState<ListingDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | undefined>(undefined);

  const load = useCallback(() => {
    fetch(`/api/listings/${encodeURIComponent(listingId)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await parseError(res, "Gagal memuat listing."));
        }
        return (await res.json()) as { listing: ListingDto };
      })
      .then((body) => setListing(body.listing))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Gagal memuat listing.");
      });
  }, [listingId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange(status: ListingStatus): Promise<void> {
    setBusy(true);
    try {
      const response = await fetch(`/api/listings/${encodeURIComponent(listingId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingStatus: status }),
      });
      if (response.ok) {
        const body = (await response.json()) as { listing: ListingDto };
        setListing(body.listing);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handlePublishKnowledge(): Promise<void> {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/listings/${encodeURIComponent(listingId)}/publish-knowledge`,
        { method: "POST" },
      );
      if (response.ok) {
        const body = (await response.json()) as { listing: ListingDto };
        setListing(body.listing);
      }
    } finally {
      setBusy(false);
    }
  }

  function copyDetailForWa(): void {
    if (listing === undefined) {
      return;
    }
    const lines = [
      listing.title,
      formatListingPrice(listing.price),
      [listing.city, listing.province].filter(Boolean).join(", "),
      listing.bedrooms !== undefined ? `${String(listing.bedrooms)} kamar tidur` : undefined,
      listing.description,
    ].filter((line): line is string => line !== undefined && line.length > 0);
    const text = lines.join("\n");
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() => setCopyMessage("Detail listing disalin."))
        .catch(() => setCopyMessage("Gagal menyalin."));
    }
  }

  if (error !== undefined) {
    return <ErrorCard message={error} />;
  }
  if (listing === undefined) {
    return <LoadingSpinner />;
  }

  const sortedPhotos = [...listing.photos].sort((a, b) => a.order - b.order);

  return (
    <div className={styles.page}>
      <div className={styles.left}>
        <div className={styles.gallery}>
          {sortedPhotos.length === 0 ? (
            <div className={styles.galleryPlaceholder}>Belum ada foto</div>
          ) : (
            sortedPhotos.map((photo) => (
              // eslint-disable-next-line @next/next/no-img-element -- external GCS URL
              <img
                key={photo.id}
                src={photo.url}
                alt={photo.label ?? listing.title}
                className={styles.galleryImg}
              />
            ))
          )}
        </div>
        <h2 className={styles.title}>{listing.title}</h2>
        <p className={styles.price}>{formatListingPrice(listing.price)}</p>
        <dl className={styles.specGrid}>
          {listing.landArea !== undefined ? (
            <SpecRow label="Luas Tanah" value={`${String(listing.landArea)} m²`} />
          ) : null}
          {listing.buildArea !== undefined ? (
            <SpecRow label="Luas Bangunan" value={`${String(listing.buildArea)} m²`} />
          ) : null}
          {listing.bedrooms !== undefined ? (
            <SpecRow label="K.Tidur" value={String(listing.bedrooms)} />
          ) : null}
          {listing.bathrooms !== undefined ? (
            <SpecRow label="K.Mandi" value={String(listing.bathrooms)} />
          ) : null}
          {listing.certificate !== undefined ? (
            <SpecRow label="Sertifikat" value={listing.certificate} />
          ) : null}
        </dl>
        {listing.description !== undefined ? (
          <p className={styles.description}>{listing.description}</p>
        ) : null}
        {listing.highlights.length > 0 ? (
          <ul className={styles.highlights}>
            {listing.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className={styles.right}>
        <button
          type="button"
          className={styles.actionButtonPrimary}
          onClick={() => router.push(`/creative?listingId=${encodeURIComponent(listingId)}`)}
        >
          🎨 Buat Creative dengan Kai →
        </button>
        <button
          type="button"
          className={styles.actionButton}
          disabled={busy || listing.inKnowledgeBase}
          onClick={() => void handlePublishKnowledge()}
        >
          {listing.inKnowledgeBase
            ? "📚 Sudah di Knowledge Samantha"
            : "📚 Jadikan Knowledge Samantha"}
        </button>
        <button type="button" className={styles.actionButton} onClick={copyDetailForWa}>
          📋 Copy detail untuk WA
        </button>
        {copyMessage !== undefined ? <p className={styles.hint}>{copyMessage}</p> : null}

        <div className={styles.statusGroup}>
          <span className={styles.formLabel}>Status</span>
          <div className={styles.statusButtons}>
            {LISTING_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                disabled={busy}
                className={`${styles.statusButton} ${
                  listing.listingStatus === status ? styles.statusButtonActive : ""
                }`}
                onClick={() => void handleStatusChange(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.ReactElement {
  return (
    <>
      <dt className={styles.specLabel}>{label}</dt>
      <dd className={styles.specValue}>{value}</dd>
    </>
  );
}
