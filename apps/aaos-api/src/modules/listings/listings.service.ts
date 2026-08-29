import { randomUUID } from "node:crypto";

import type { AssetLibrary } from "@aos/asset-library";
import { ALLOWED_IMAGE_MIME_TYPES } from "@aos/asset-library";
import { NotFoundError, UnavailableError, ValidationError } from "@aos/errors";
import { Inject, Injectable } from "@nestjs/common";

import { ASSET_LIBRARY } from "../../di-tokens.js";

import { buildPropertyKnowledge, type PropertyKnowledge } from "./domain/property-knowledge.js";
import type {
  CreateListingBodyDto,
  GetListingsQueryDto,
  ListingListResponseDto,
  ListingResponseDto,
  PhotoResponseDto,
  ReorderPhotosBodyDto,
  UpdateListingBodyDto,
} from "./dto/listing.dto.js";
import type {
  ListingInsert,
  ListingPhotoRow,
  ListingRow,
  ListingUpdate,
} from "./infrastructure/listing.repository.js";
import { ListingRepository } from "./infrastructure/listing.repository.js";

/** Spec Part 4's "max 10MB/foto, max 20 foto" — the ONLY place these limits are enforced (Zod can't inspect file bytes). */
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS_PER_LISTING = 20;

export interface AddPhotoInput {
  readonly buffer: Buffer;
  readonly fileName: string;
  readonly mimeType: string;
  readonly label?: string;
}

function toPhotoDto(row: ListingPhotoRow): PhotoResponseDto {
  return {
    id: row.id,
    url: row.url,
    ...(row.label !== undefined ? { label: row.label } : {}),
    order: row.order,
    isMain: row.isMain,
  };
}

function toListingDto(row: ListingRow): ListingResponseDto {
  return {
    id: row.id,
    title: row.title,
    propertyType: row.property_type as ListingResponseDto["propertyType"],
    listingStatus: row.listing_status as ListingResponseDto["listingStatus"],
    price: row.price,
    ...(row.branch_id !== null ? { branchId: row.branch_id } : {}),
    ...(row.wa_number !== null ? { waNumber: row.wa_number } : {}),
    ...(row.land_area !== null ? { landArea: row.land_area } : {}),
    ...(row.build_area !== null ? { buildArea: row.build_area } : {}),
    ...(row.bedrooms !== null ? { bedrooms: row.bedrooms } : {}),
    ...(row.bathrooms !== null ? { bathrooms: row.bathrooms } : {}),
    ...(row.garage !== null ? { garage: row.garage } : {}),
    ...(row.floors !== null ? { floors: row.floors } : {}),
    ...(row.certificate !== null ? { certificate: row.certificate } : {}),
    ...(row.condition !== null ? { condition: row.condition } : {}),
    ...(row.electricity !== null ? { electricity: row.electricity } : {}),
    ...(row.facing !== null ? { facing: row.facing } : {}),
    ...(row.address !== null ? { address: row.address } : {}),
    ...(row.city !== null ? { city: row.city } : {}),
    ...(row.province !== null ? { province: row.province } : {}),
    ...(row.postal_code !== null ? { postalCode: row.postal_code } : {}),
    ...(row.description !== null ? { description: row.description } : {}),
    highlights: row.highlights,
    photos: row.photos.map(toPhotoDto),
    ...(row.main_photo_url !== null ? { mainPhotoUrl: row.main_photo_url } : {}),
    inKnowledgeBase: row.in_knowledge_base,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mainPhotoUrlOf(photos: readonly ListingPhotoRow[]): string | null {
  return photos.find((p) => p.isMain)?.url ?? photos[0]?.url ?? null;
}

/**
 * `modules/listings` — the Listing Manager's backend (`/listings` + `/listings/:id`,
 * AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 2 Part 4). Every method is tenant-scoped (never
 * relies on the `listings.tenant_id` column default), same discipline `SettingsService` already
 * establishes.
 *
 * Photo upload reuses `@aos/asset-library`'s real `IAssetStorage` (GCS) adapter directly via the
 * shared `ASSET_LIBRARY` composition — never a second GCS wiring path — but deliberately bypasses
 * that package's `UploadAsset` use case / `assets` table: a listing photo is not an `Asset` domain
 * entity (no tagging, no unit/branch derivation, no `asset_uploaded` event) — it is a plain
 * `{ id, url, label, order, isMain }` entry inside `listings.photos` JSONB, exactly the shape the
 * Listing Manager UI needs and nothing more.
 */
@Injectable()
export class ListingsService {
  constructor(
    private readonly repository: ListingRepository,
    @Inject(ASSET_LIBRARY) private readonly assetLibrary: AssetLibrary | undefined,
  ) {}

  async list(tenantId: string, query: GetListingsQueryDto): Promise<ListingListResponseDto> {
    const rows = await this.repository.listByTenant(tenantId);
    const filtered = rows.filter((row) => {
      if (query.status !== undefined && row.listing_status !== query.status) {
        return false;
      }
      if (query.propertyType !== undefined && row.property_type !== query.propertyType) {
        return false;
      }
      if (query.search !== undefined) {
        const needle = query.search.toLowerCase();
        if (!row.title.toLowerCase().includes(needle)) {
          return false;
        }
      }
      return true;
    });
    return { listings: filtered.map(toListingDto), total: filtered.length };
  }

  private async requireRow(tenantId: string, id: string): Promise<ListingRow> {
    const row = await this.repository.findById(id);
    if (row === undefined || row.tenant_id !== tenantId) {
      throw new NotFoundError(`No listing found for id "${id}"`);
    }
    return row;
  }

  async getById(tenantId: string, id: string): Promise<ListingResponseDto> {
    return toListingDto(await this.requireRow(tenantId, id));
  }

  async create(tenantId: string, dto: CreateListingBodyDto): Promise<ListingResponseDto> {
    const insert: ListingInsert = {
      tenant_id: tenantId,
      title: dto.title,
      property_type: dto.propertyType,
      listing_status: dto.listingStatus ?? "DRAFT",
      price: dto.price,
      branch_id: dto.branchId ?? null,
      wa_number: dto.waNumber ?? null,
      land_area: dto.landArea ?? null,
      build_area: dto.buildArea ?? null,
      bedrooms: dto.bedrooms ?? null,
      bathrooms: dto.bathrooms ?? null,
      garage: dto.garage ?? null,
      floors: dto.floors ?? null,
      certificate: dto.certificate ?? null,
      condition: dto.condition ?? null,
      electricity: dto.electricity ?? null,
      facing: dto.facing ?? null,
      address: dto.address ?? null,
      city: dto.city ?? null,
      province: dto.province ?? null,
      postal_code: dto.postalCode ?? null,
      description: dto.description ?? null,
      highlights: dto.highlights ?? [],
      photos: [],
      main_photo_url: null,
      in_knowledge_base: false,
    };
    const row = await this.repository.insert(insert);
    return toListingDto(row);
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateListingBodyDto,
  ): Promise<ListingResponseDto> {
    await this.requireRow(tenantId, id);
    const patch: ListingUpdate = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.propertyType !== undefined ? { property_type: dto.propertyType } : {}),
      ...(dto.listingStatus !== undefined ? { listing_status: dto.listingStatus } : {}),
      ...(dto.price !== undefined ? { price: dto.price } : {}),
      ...(dto.branchId !== undefined ? { branch_id: dto.branchId } : {}),
      ...(dto.waNumber !== undefined ? { wa_number: dto.waNumber } : {}),
      ...(dto.landArea !== undefined ? { land_area: dto.landArea } : {}),
      ...(dto.buildArea !== undefined ? { build_area: dto.buildArea } : {}),
      ...(dto.bedrooms !== undefined ? { bedrooms: dto.bedrooms } : {}),
      ...(dto.bathrooms !== undefined ? { bathrooms: dto.bathrooms } : {}),
      ...(dto.garage !== undefined ? { garage: dto.garage } : {}),
      ...(dto.floors !== undefined ? { floors: dto.floors } : {}),
      ...(dto.certificate !== undefined ? { certificate: dto.certificate } : {}),
      ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
      ...(dto.electricity !== undefined ? { electricity: dto.electricity } : {}),
      ...(dto.facing !== undefined ? { facing: dto.facing } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {}),
      ...(dto.city !== undefined ? { city: dto.city } : {}),
      ...(dto.province !== undefined ? { province: dto.province } : {}),
      ...(dto.postalCode !== undefined ? { postal_code: dto.postalCode } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.highlights !== undefined ? { highlights: dto.highlights } : {}),
      updated_at: new Date().toISOString(),
    };
    const row = await this.repository.updateById(id, patch);
    return toListingDto(row);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.requireRow(tenantId, id);
    await this.repository.deleteById(id);
  }

  private requireAssetLibrary(): AssetLibrary {
    if (this.assetLibrary === undefined) {
      throw new UnavailableError(
        "Asset library is not configured on this deployment — set GCS_PROJECT_ID and one of " +
          "GCS_CREDENTIALS / GCS_KEY_FILE_PATH to enable listing photo uploads.",
      );
    }
    return this.assetLibrary;
  }

  /** `POST /api/v1/listings/:id/photos` — spec Part 4's drag&drop upload. First photo on a listing is automatically the main photo. */
  async addPhoto(tenantId: string, id: string, input: AddPhotoInput): Promise<ListingResponseDto> {
    const row = await this.requireRow(tenantId, id);
    if (row.photos.length >= MAX_PHOTOS_PER_LISTING) {
      throw new ValidationError(
        `Listing "${id}" already has the maximum of ${String(MAX_PHOTOS_PER_LISTING)} photos`,
      );
    }
    if (input.buffer.length > MAX_PHOTO_BYTES) {
      throw new ValidationError(
        `Photo exceeds the ${String(MAX_PHOTO_BYTES / (1024 * 1024))}MB limit`,
      );
    }
    if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
      throw new ValidationError(
        `Photo mime type must be one of ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}, received: ${input.mimeType}`,
      );
    }

    const library = this.requireAssetLibrary();
    const extension = extensionFromMime(input.mimeType);
    const path = `listings/${tenantId}/${id}/photo-${String(Date.now())}.${extension}`;
    const uploaded = await library.assetStorage.upload({
      path,
      fileBody: input.buffer,
      contentType: input.mimeType,
    });
    if (!uploaded.ok) {
      throw uploaded.error;
    }

    const newPhoto: ListingPhotoRow = {
      id: randomUUID(),
      url: uploaded.value.publicUrl,
      ...(input.label !== undefined ? { label: input.label } : {}),
      order: row.photos.length,
      isMain: row.photos.length === 0,
    };
    const photos = [...row.photos, newPhoto];
    const updated = await this.repository.updateById(id, {
      photos,
      main_photo_url: mainPhotoUrlOf(photos),
      updated_at: new Date().toISOString(),
    });
    return toListingDto(updated);
  }

  /** `DELETE /api/v1/listings/:id/photos/:photoId`. Removes the JSONB entry only — same "no hard delete of the underlying object" discipline `AssetsService.archive` documents (`IAssetStorage` has no delete method). If the removed photo was the main photo, the next remaining photo (by order) becomes main. */
  async deletePhoto(tenantId: string, id: string, photoId: string): Promise<ListingResponseDto> {
    const row = await this.requireRow(tenantId, id);
    const remaining = row.photos.filter((p) => p.id !== photoId);
    if (remaining.length === row.photos.length) {
      throw new NotFoundError(`No photo "${photoId}" found on listing "${id}"`);
    }
    const hadMain = row.photos.find((p) => p.id === photoId)?.isMain === true;
    const reindexed = remaining
      .sort((a, b) => a.order - b.order)
      .map((p, index) => ({
        ...p,
        order: index,
        isMain: hadMain && index === 0 ? true : p.isMain,
      }));
    const updated = await this.repository.updateById(id, {
      photos: reindexed,
      main_photo_url: mainPhotoUrlOf(reindexed),
      updated_at: new Date().toISOString(),
    });
    return toListingDto(updated);
  }

  /** `PUT /api/v1/listings/:id/photos/reorder` — drag-to-reorder + "set foto utama" (⭐), one write. */
  async reorderPhotos(
    tenantId: string,
    id: string,
    dto: ReorderPhotosBodyDto,
  ): Promise<ListingResponseDto> {
    const row = await this.requireRow(tenantId, id);
    const byId = new Map(row.photos.map((p) => [p.id, p] as const));
    if (dto.photoIds.length !== row.photos.length || dto.photoIds.some((pid) => !byId.has(pid))) {
      throw new ValidationError(
        `photoIds must be a permutation of listing "${id}"'s existing photo ids`,
      );
    }
    const reordered = dto.photoIds.map((photoId, index) => {
      const photo = byId.get(photoId);
      /* v8 ignore start -- guarded above: every id in dto.photoIds is confirmed present in byId. */
      if (photo === undefined) {
        throw new NotFoundError(`No photo "${photoId}" found on listing "${id}"`);
      }
      /* v8 ignore stop */
      return {
        ...photo,
        order: index,
        isMain: dto.mainPhotoId !== undefined ? photoId === dto.mainPhotoId : photo.isMain,
      };
    });
    const updated = await this.repository.updateById(id, {
      photos: reordered,
      main_photo_url: mainPhotoUrlOf(reordered),
      updated_at: new Date().toISOString(),
    });
    return toListingDto(updated);
  }

  /** `POST /api/v1/listings/:id/publish-knowledge` — Listing Detail's "📚 Jadikan Knowledge Samantha" action. Marks this listing as included in Clara's `PropertyKnowledge` (see `domain/property-knowledge.ts`). */
  async publishKnowledge(tenantId: string, id: string): Promise<ListingResponseDto> {
    await this.requireRow(tenantId, id);
    const updated = await this.repository.updateById(id, {
      in_knowledge_base: true,
      updated_at: new Date().toISOString(),
    });
    return toListingDto(updated);
  }

  /** The full `PropertyKnowledge` aggregate Clara's knowledge builder consumes — every listing this tenant has explicitly published (`in_knowledge_base = true`). */
  async buildPropertyKnowledge(tenantId: string): Promise<PropertyKnowledge> {
    const rows = await this.repository.listByTenant(tenantId);
    return buildPropertyKnowledge(rows.map(toListingDto));
  }
}

function extensionFromMime(mimeType: string): string {
  const map: Readonly<Record<string, string>> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return map[mimeType] ?? "bin";
}
