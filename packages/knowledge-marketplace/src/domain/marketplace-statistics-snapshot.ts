import { z } from "zod";

/** Per-`MarketplaceCategoryName` statistics snapshot — the `MarketplaceStatistics` aggregate. */
export const marketplaceStatisticsSnapshotSchema = z.object({
  listedCount: z.number().int().min(0),
  publishedCount: z.number().int().min(0),
  lastActivityAt: z.string().datetime().optional(),
});

export type MarketplaceStatisticsSnapshot = z.infer<typeof marketplaceStatisticsSnapshotSchema>;

export const EMPTY_MARKETPLACE_STATISTICS: MarketplaceStatisticsSnapshot = {
  listedCount: 0,
  publishedCount: 0,
  lastActivityAt: undefined,
};
