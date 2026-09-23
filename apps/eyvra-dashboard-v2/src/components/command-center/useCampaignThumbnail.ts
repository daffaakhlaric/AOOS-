"use client";

import { useEffect, useState } from "react";

import type { CampaignListingIdResponseDto, ListingDto } from "@/types/dashboard.types";

/**
 * Resolves ONE Samantha Attention Queue row's real property photo, over the real two-hop chain:
 *
 *   1. `GET /api/campaigns/:campaignId/listing-id` -> real `{ listingId: string | null }`
 *      (aaos-api `MetaAdsController.getCampaignListingId`)
 *   2. `GET /api/listings/:id` -> real `mainPhotoUrl` / `photos[]`
 *      (aaos-api `ListingsController.byId`; `mainPhotoUrl` = `photos.find(isMain) ?? photos[0]`)
 *
 * Deliberately best-effort and NON-BLOCKING: the decision row renders immediately from the
 * already-loaded account summary, and this only ever *adds* a photo once both real hops succeed.
 * Every failure mode — unlinked campaign (`listingId === null`), listing with no photos, 4xx/5xx,
 * network error, unmount mid-flight — leaves the return value `undefined`, so the caller keeps its
 * honest placeholder tile. A stock/random/placeholder-service image is never substituted.
 *
 * Called per rendered row (the queue renders at most 6), so at most 6 x 2 small GETs, each
 * independently cancellable via the same `cancelled` flag pattern used elsewhere in this app.
 */
export function useCampaignThumbnail(campaignId: string): {
  readonly url?: string;
  readonly onImageError: () => void;
} {
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const resolve = async (): Promise<void> => {
      const listingIdResponse = await fetch(
        `/api/campaigns/${encodeURIComponent(campaignId)}/listing-id`,
      );
      if (cancelled || !listingIdResponse.ok) return;
      const mapping = (await listingIdResponse.json()) as CampaignListingIdResponseDto;
      const listingId = mapping.listingId;
      // Real, honest "this campaign was never linked to a listing" — nothing to render.
      if (cancelled || listingId === null || listingId.length === 0) return;

      const listingResponse = await fetch(`/api/listings/${encodeURIComponent(listingId)}`);
      if (cancelled || !listingResponse.ok) return;
      const listing = (await listingResponse.json()) as ListingDto;
      const photoUrl =
        listing.mainPhotoUrl ??
        listing.photos?.find((photo) => photo.isMain)?.url ??
        listing.photos?.[0]?.url;
      if (cancelled || photoUrl === undefined || photoUrl.length === 0) return;
      setUrl(photoUrl);
    };

    resolve().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  return {
    ...(url !== undefined ? { url } : {}),
    /** A real URL that fails to load in the browser falls back to the same honest placeholder. */
    onImageError: (): void => setUrl(undefined),
  };
}
