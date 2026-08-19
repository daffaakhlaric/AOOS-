import { z } from "zod";

/** Mirrors the Listing Manager modal's "Tipe Properti *" options (spec Part 4). */
export const PROPERTY_TYPES = ["RUMAH", "APARTEMEN", "RUKO", "TANAH", "VILLA"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

/** Mirrors the modal's "Status *" options (spec Part 4). */
export const LISTING_STATUSES = ["AKTIF", "DISEWAKAN", "TERJUAL", "DRAFT"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

/** `POST /api/v1/listings` body — the Tambah Listing modal's "INFORMASI DASAR"/"SPESIFIKASI"/"LOKASI"/"DESKRIPSI & KEUNGGULAN" sections. Photos are added separately via `POST /:id/photos` (real file bytes, never inlined into this JSON body). */
export const CreateListingBodySchema = z.object({
  title: z.string().min(1, "title must not be empty"),
  propertyType: z.enum(PROPERTY_TYPES),
  listingStatus: z.enum(LISTING_STATUSES).optional(),
  price: z.number().int().positive("price must be a positive integer"),
  branchId: z.string().min(1).optional(),
  waNumber: z.string().min(1).optional(),

  landArea: z.number().int().nonnegative().optional(),
  buildArea: z.number().int().nonnegative().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  garage: z.number().int().nonnegative().optional(),
  floors: z.number().int().nonnegative().optional(),
  certificate: z.string().min(1).optional(),
  condition: z.string().min(1).optional(),
  electricity: z.number().int().nonnegative().optional(),
  facing: z.string().min(1).optional(),

  address: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  province: z.string().min(1).optional(),
  postalCode: z.string().min(1).optional(),

  description: z.string().optional(),
  highlights: z.array(z.string().min(1)).optional(),
});
export type CreateListingBodyDto = z.infer<typeof CreateListingBodySchema>;

/** `PUT /api/v1/listings/:id` body — every field optional (partial patch), same "omit to keep unchanged" discipline as `UpdateWabaConfigBodySchema`. */
export const UpdateListingBodySchema = CreateListingBodySchema.partial();
export type UpdateListingBodyDto = z.infer<typeof UpdateListingBodySchema>;

/** `GET /api/v1/listings` query — the Listing Manager's filter/search bar. */
export const GetListingsQuerySchema = z.object({
  status: z.enum(LISTING_STATUSES).optional(),
  propertyType: z.enum(PROPERTY_TYPES).optional(),
  search: z.string().min(1).optional(),
});
export type GetListingsQueryDto = z.infer<typeof GetListingsQuerySchema>;

/** `PUT /api/v1/listings/:id/photos/reorder` body — drag-to-reorder + "set foto utama" (⭐) from the same modal, folded into one call since both mutate the same `photos` array in one write. */
export const ReorderPhotosBodySchema = z.object({
  photoIds: z.array(z.string().min(1)).min(1, "photoIds must not be empty"),
  mainPhotoId: z.string().min(1).optional(),
});
export type ReorderPhotosBodyDto = z.infer<typeof ReorderPhotosBodySchema>;

export interface PhotoResponseDto {
  readonly id: string;
  readonly url: string;
  readonly label?: string;
  readonly order: number;
  readonly isMain: boolean;
}

export interface ListingResponseDto {
  readonly id: string;
  readonly title: string;
  readonly propertyType: PropertyType;
  readonly listingStatus: ListingStatus;
  readonly price: number;
  readonly branchId?: string;
  readonly waNumber?: string;

  readonly landArea?: number;
  readonly buildArea?: number;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly garage?: number;
  readonly floors?: number;
  readonly certificate?: string;
  readonly condition?: string;
  readonly electricity?: number;
  readonly facing?: string;

  readonly address?: string;
  readonly city?: string;
  readonly province?: string;
  readonly postalCode?: string;

  readonly description?: string;
  readonly highlights: readonly string[];

  readonly photos: readonly PhotoResponseDto[];
  readonly mainPhotoUrl?: string;
  readonly inKnowledgeBase: boolean;

  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListingListResponseDto {
  readonly listings: readonly ListingResponseDto[];
  readonly total: number;
}

/** Response for `POST /api/v1/listings/:id/publish-knowledge` — spec Part 6's `PropertyKnowledge` interface, scoped to the single listing just published (the aggregate, all-listings shape is `ListingsService.buildPropertyKnowledge`, used server-side by Jessy's knowledge builder, not exposed as its own HTTP response here). */
export interface PublishKnowledgeResponseDto {
  readonly listing: ListingResponseDto;
  readonly inKnowledgeBase: true;
}
