import { Card } from "@/components/common/Card";
import { formatIdr } from "@/lib/formatters";
import { presentLabel } from "@/lib/presentation";
import { PRIMARY_GOAL_LABELS, type StressTestRunDto } from "@/lib/stress-test";
import type { ListingContext } from "@/lib/stress-test-result";
import { EvidenceBadge } from "./EvidenceBadge";
import styles from "./result.module.css";

const DASH = "—";

/**
 * Context card: real listing facts (LISTING DATA) when the run relates to a listing, plus the run's
 * real primary goal. Objective / Target Audience / Budget have no real source on a stress-test run
 * (the run stores none of them) and are always "—".
 */
export function RunContextCard({
  run,
  listing,
  loading,
}: {
  readonly run: StressTestRunDto;
  readonly listing?: ListingContext;
  readonly loading: boolean;
}): React.ReactElement {
  const thumb = listing?.mainPhotoUrl ?? listing?.photos[0]?.url;
  const location = [listing?.city, listing?.province]
    .filter((v): v is string => v !== undefined)
    .join(", ");
  const area =
    listing?.landArea !== undefined || listing?.buildArea !== undefined
      ? [
          listing.landArea !== undefined ? `LT ${String(listing.landArea)} m²` : undefined,
          listing.buildArea !== undefined ? `LB ${String(listing.buildArea)} m²` : undefined,
        ]
          .filter((v): v is string => v !== undefined)
          .join(" · ")
      : DASH;

  return (
    <Card title="Konteks Run" testId="stress-test-context-card">
      <div className={styles.contextRow}>
        {thumb !== undefined ? (
          // eslint-disable-next-line @next/next/no-img-element -- real tenant listing photo, same pattern as ListingEditor
          <img className={styles.contextThumb} src={thumb} alt="" />
        ) : (
          <div className={`${styles.contextThumb} ${styles.thumbPlaceholder}`}>Tidak ada foto</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={styles.contextTitle}>
            <span data-testid="stress-test-context-title">
              {listing?.title ??
                (loading
                  ? "Memuat listing…"
                  : run.listingId !== undefined
                    ? "Listing belum dapat dimuat"
                    : `Sumber: ${presentLabel(run.sourceType)}`)}
            </span>
            {listing !== undefined ? <EvidenceBadge kind="LISTING_DATA" /> : null}
          </div>
          <div className={styles.factGrid} style={{ marginTop: 10 }}>
            <div>
              <span>Lokasi</span>
              <strong>{location.length > 0 ? location : DASH}</strong>
            </div>
            <div>
              <span>Harga</span>
              <strong>{listing?.price !== undefined ? formatIdr(listing.price) : DASH}</strong>
            </div>
            <div>
              <span>Luas</span>
              <strong>{area}</strong>
            </div>
            <div>
              <span>Sertifikat</span>
              <strong>{listing?.certificate ?? DASH}</strong>
            </div>
            <div>
              <span>Status Listing</span>
              <strong>
                {listing?.listingStatus !== undefined ? presentLabel(listing.listingStatus) : DASH}
              </strong>
            </div>
            <div>
              <span>Primary Goal Run</span>
              <strong>{PRIMARY_GOAL_LABELS[run.primaryGoal]}</strong>
            </div>
            <div>
              <span>Objective</span>
              <strong data-testid="stress-test-context-objective">{DASH}</strong>
            </div>
            <div>
              <span>Target Audience</span>
              <strong>{DASH}</strong>
            </div>
            <div>
              <span>Budget</span>
              <strong>{DASH}</strong>
            </div>
          </div>
          <p className={styles.note}>
            Objective, target audience, dan budget tidak disimpan pada run uji ketahanan —
            ditampilkan &ldquo;—&rdquo;.
          </p>
        </div>
      </div>
    </Card>
  );
}
