import { z } from "zod";

/** `POST /api/v1/superadmin/campaigns/backfill-listing-links` body — real, tenant-scoped maintenance trigger. */
export const BackfillListingLinksBodySchema = z.object({
  tenantId: z.string().trim().min(1),
});

export type BackfillListingLinksBodyDto = z.infer<typeof BackfillListingLinksBodySchema>;

/**
 * Campaign->Listing Mapping backfill result (`CampaignsService.backfillListingLinks`) — real counts
 * from ONE real Meta ad-account pull + one real `listings.list` scan, never estimated/fabricated.
 */
export interface BackfillListingLinksResultDto {
  /** Every real tenant listing scanned (no filter/pagination cap — `ListingsService.list(tenantId, {})`). */
  readonly listingsChecked: number;
  /** Every real `matchActiveCampaignForListing` match found across all scanned listings. */
  readonly campaignsMatched: number;
  /** Of `campaignsMatched`, how many `MetaSyncRepository.linkCampaignListing` UPDATEs actually touched a row (already-linked/unrecognized `meta_campaign_id` rows don't count). */
  readonly campaignsLinked: number;
}
