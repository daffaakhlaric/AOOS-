import Link from "next/link";

import { formatListingPrice, type ListingDto } from "@/types/listing.types";

import styles from "./ListingCard.module.css";

/**
 * Listing Manager grid card (spec Part 4 mockup): main photo, title, price, area/specs summary,
 * photo count + status, `[Edit]`/`[Kai →]` actions.
 */
export function ListingCard({
  listing,
  onEdit,
}: {
  readonly listing: ListingDto;
  readonly onEdit: () => void;
}): React.ReactElement {
  const specs = [
    listing.bedrooms !== undefined ? `KT${String(listing.bedrooms)}` : undefined,
    listing.bathrooms !== undefined ? `KM${String(listing.bathrooms)}` : undefined,
  ].filter((s): s is string => s !== undefined);

  return (
    <section data-testid="listing-card" className={styles.card}>
      <div className={styles.photoWrap}>
        {listing.mainPhotoUrl !== undefined ? (
          // eslint-disable-next-line @next/next/no-img-element -- external GCS URL, no next/image loader configured for this bucket
          <img src={listing.mainPhotoUrl} alt={listing.title} className={styles.photo} />
        ) : (
          <div className={styles.photoPlaceholder} aria-hidden="true">
            🏠
          </div>
        )}
      </div>
      <div className={styles.body}>
        <p className={styles.title}>{listing.title}</p>
        <p className={styles.price}>{formatListingPrice(listing.price)}</p>
        <p className={styles.meta}>
          {[listing.city ?? listing.branchId, ...specs].filter(Boolean).join(" · ")}
        </p>
        <p className={styles.meta}>
          {listing.photos.length} foto · {listing.listingStatus}
        </p>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.actionButton} onClick={onEdit}>
          Edit
        </button>
        <Link href={`/listings/${listing.id}`} className={styles.actionButton}>
          Kai →
        </Link>
      </div>
    </section>
  );
}
