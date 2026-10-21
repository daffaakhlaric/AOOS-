import { randomUUID } from "node:crypto";

import type { AssetLibrary } from "@aos/asset-library";
import { ALLOWED_IMAGE_MIME_TYPES } from "@aos/asset-library";
import { NotFoundError, UnavailableError, ValidationError } from "@aos/errors";
import { Inject, Injectable, Optional } from "@nestjs/common";

import { ASSET_LIBRARY } from "../../di-tokens.js";

import { buildListingAdvertising } from "./domain/listing-advertising.js";
import { buildPropertyKnowledge, type PropertyKnowledge } from "./domain/property-knowledge.js";
import type {
  CreateListingBodyDto,
  DraftListingBodyDto,
  DocumentResponseDto,
  GetListingsQueryDto,
  ListingListResponseDto,
  ListingResponseDto,
  PhotoResponseDto,
  ReorderPhotosBodyDto,
  UpdateListingBodyDto,
} from "./dto/listing.dto.js";
import type {
  ListingDocumentRow,
  ListingInsert,
  ListingPhotoRow,
  ListingRow,
  ListingUpdate,
} from "./infrastructure/listing.repository.js";
import { ListingRepository } from "./infrastructure/listing.repository.js";
import { MetaLeadDestinationsService } from "./meta-lead-destinations.service.js";

/** Spec Part 4's "max 10MB/foto, max 20 foto" — the ONLY place these limits are enforced (Zod can't inspect file bytes). */
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS_PER_LISTING = 20;

/**
 * Phase 2 (docs/PROMPT-AAOS-PROPERTY-TENANT-ISOLATION-DOCS.md) — listing supporting documents
 * (PDF/Excel/promo). No spec-given size/count limit exists for this genuinely new feature, so
 * these mirror `MAX_PHOTO_BYTES`/`MAX_PHOTOS_PER_LISTING`'s own precedent, sized up from 10MB to
 * 20MB since a real promo PDF/brochure or a multi-sheet Excel price list commonly runs larger than
 * a single compressed photo.
 */
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const MAX_DOCUMENTS_PER_LISTING = 20;

/**
 * Own, honest MIME allowlist for this endpoint — deliberately NOT `@aos/asset-library`'s
 * `MimeType.create()` (that value object only allows `ALLOWED_IMAGE_MIME_TYPES`/
 * `ALLOWED_VIDEO_MIME_TYPES`, no document types) and NOT reusing `ALLOWED_IMAGE_MIME_TYPES` the
 * way `addPhoto` does. PDF + the two real Excel MIME types Office actually emits (.xlsx via the
 * modern OOXML type, .xls via the legacy `application/vnd.ms-excel` type) — no fabricated types.
 */
const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
] as const;

export interface AddPhotoInput {
  readonly buffer: Buffer;
  readonly fileName: string;
  readonly mimeType: string;
  readonly label?: string;
}

export interface AddDocumentInput {
  readonly buffer: Buffer;
  readonly fileName: string;
  readonly mimeType: string;
  readonly label?: string;
}

/**
 * Local, narrower view of the real `delete(path)` capability `GcsStorageClient` implements
 * (`packages/asset-library/src/infrastructure/gcs/GcsStorageClient.ts`, verified directly) but
 * `IAssetStorage`'s public contract does NOT declare (only `upload`/`getSignedUrl` are part of
 * that interface). Same local-cast discipline `ListingRepository`'s own `DeletableSupabaseClient`
 * already establishes in this module family for an analogous "concrete class exposes more than
 * the shared interface" gap — never widening the shared `@aos/asset-library` package's contract
 * for one caller.
 */
interface DeletableAssetStorage {
  delete(path: string): Promise<{ readonly ok: boolean }>;
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

function toDocumentDto(row: ListingDocumentRow): DocumentResponseDto {
  return {
    id: row.id,
    filename: row.filename,
    url: row.url,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    ...(row.label !== undefined ? { label: row.label } : {}),
    uploadedAt: row.uploadedAt,
  };
}

function toListingDto(row: ListingRow): ListingResponseDto {
  return {
    id: row.id,
    title: row.title,
    propertyType: row.property_type as ListingResponseDto["propertyType"],
    listingStatus: row.listing_status as ListingResponseDto["listingStatus"],
    price: row.price,
    ...(row.meta_page_id ? { metaPageId: row.meta_page_id } : {}),
    ...(row.meta_ad_account_id ? { metaAdAccountId: row.meta_ad_account_id } : {}),
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
    ...(row.kecamatan !== null ? { kecamatan: row.kecamatan } : {}),
    ...(row.postal_code !== null ? { postalCode: row.postal_code } : {}),
    ...(row.description !== null ? { description: row.description } : {}),
    highlights: row.highlights,
    photos: row.photos.map(toPhotoDto),
    ...(row.main_photo_url !== null ? { mainPhotoUrl: row.main_photo_url } : {}),
    documents: row.documents.map(toDocumentDto),
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
    @Optional() private readonly destinations?: MetaLeadDestinationsService,
  ) {}

  async leadDestinations(tenantId: string) {
    if (!this.destinations) throw new UnavailableError("Layanan tujuan Meta belum tersedia.");
    return this.destinations.list(tenantId);
  }
  private async validateDestination(
    tenantId: string,
    pageId?: string | null,
    accountId?: string | null,
    number?: string | null,
  ) {
    if (!pageId && !accountId) return;
    if (!pageId || !accountId || !number || !this.destinations)
      throw new ValidationError("Pilih Page dan WhatsApp Business yang lengkap.");
    await this.destinations.validate(tenantId, pageId, accountId, number);
  }
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

  async saveDraft(tenantId: string, id: string, dto: DraftListingBodyDto) {
    const current = await this.requireRow(tenantId, id);
    if (current.listing_status !== "DRAFT")
      throw new ValidationError("Only drafts may use incomplete data");
    return this.update(tenantId, id, { ...dto, listingStatus: "DRAFT" });
  }
  async finish(tenantId: string, id: string) {
    const row = await this.requireRow(tenantId, id);
    if (
      !row.title.trim() ||
      row.price <= 0 ||
      row.property_type === "UNSPECIFIED" ||
      !row.city ||
      !row.address
    )
      throw new ValidationError("Judul, tipe, harga, alamat dan kota wajib diisi");
    return this.update(tenantId, id, { listingStatus: "AKTIF" });
  }
  async advertisingInventory(tenantId: string) {
    const inventory = await this.list(tenantId, {});
    let campaigns: Awaited<ReturnType<ListingRepository["advertisingCampaigns"]>> | undefined;
    const errors: string[] = [];
    try {
      campaigns = await this.repository.advertisingCampaigns(tenantId);
    } catch {
      errors.push("Hubungan campaign belum dapat dimuat. Status campaign tidak dapat dipastikan.");
    }
    return {
      listings: inventory.listings.map(buildListingAdvertising),
      total: inventory.total,
      campaigns: campaigns
        ?.filter((c) => c.listing_id !== null)
        .map((c) => ({
          listingId: c.listing_id,
          id: c.meta_campaign_id,
          name: c.name,
          status: c.status,
          syncedAt: c.synced_at,
        })),
      errors,
    };
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

  async detailWorkspace(tenantId: string, id: string) {
    const listing = await this.getById(tenantId, id);
    const errors: string[] = [];
    let campaigns:
      { id: string; listingId: string; name: string; status: string; syncedAt: string }[] | null =
      null;
    try {
      campaigns = (await this.repository.advertisingCampaigns(tenantId))
        .filter((c) => c.listing_id === id)
        .map((c) => ({
          id: c.meta_campaign_id,
          listingId: id,
          name: c.name,
          status: c.status,
          syncedAt: c.synced_at,
        }));
    } catch {
      errors.push("Hubungan campaign sementara tidak tersedia.");
    }
    return { ...buildListingAdvertising(listing), campaigns, errors };
  }

  async create(
    tenantId: string,
    dto: CreateListingBodyDto | DraftListingBodyDto,
  ): Promise<ListingResponseDto> {
    await this.validateDestination(tenantId, dto.metaPageId, dto.metaAdAccountId, dto.waNumber);
    const insert: ListingInsert = {
      tenant_id: tenantId,
      title: dto.title,
      property_type: dto.propertyType ?? "UNSPECIFIED",
      listing_status: dto.listingStatus ?? "DRAFT",
      price: dto.price ?? 0,
      branch_id: dto.branchId ?? null,
      wa_number: dto.waNumber ?? null,
      ...(dto.metaPageId && dto.metaAdAccountId
        ? { meta_page_id: dto.metaPageId, meta_ad_account_id: dto.metaAdAccountId }
        : {}),
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
      kecamatan: dto.kecamatan ?? null,
      postal_code: dto.postalCode ?? null,
      description: dto.description ?? null,
      highlights: dto.highlights ?? [],
      photos: [],
      main_photo_url: null,
      documents: [],
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
    const existing = await this.requireRow(tenantId, id);
    if (
      dto.metaPageId !== undefined ||
      dto.metaAdAccountId !== undefined ||
      dto.waNumber !== undefined
    )
      await this.validateDestination(
        tenantId,
        dto.metaPageId === undefined ? existing.meta_page_id : dto.metaPageId,
        dto.metaAdAccountId === undefined ? existing.meta_ad_account_id : dto.metaAdAccountId,
        dto.waNumber === undefined ? existing.wa_number : dto.waNumber,
      );
    const patch: ListingUpdate = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.propertyType !== undefined ? { property_type: dto.propertyType } : {}),
      ...(dto.listingStatus !== undefined ? { listing_status: dto.listingStatus } : {}),
      ...(dto.price !== undefined ? { price: dto.price } : {}),
      ...(dto.branchId !== undefined ? { branch_id: dto.branchId } : {}),
      ...(dto.metaPageId !== undefined ? { meta_page_id: dto.metaPageId } : {}),
      ...(dto.metaAdAccountId !== undefined ? { meta_ad_account_id: dto.metaAdAccountId } : {}),
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
      ...(dto.kecamatan !== undefined ? { kecamatan: dto.kecamatan } : {}),
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
      storagePath: uploaded.value.path,
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

  /**
   * `POST /api/v1/listings/:id/documents` — Phase 2's PDF/Excel/promo document attach. Exact same
   * "bypass `@aos/asset-library`'s `UploadAsset`/`assets` table, upload via the shared
   * `IAssetStorage` adapter directly, store a plain JSONB entry" pattern `addPhoto` establishes —
   * a listing document is not an `Asset` domain entity either.
   */
  async addDocument(
    tenantId: string,
    id: string,
    input: AddDocumentInput,
  ): Promise<ListingResponseDto> {
    const row = await this.requireRow(tenantId, id);
    if (row.documents.length >= MAX_DOCUMENTS_PER_LISTING) {
      throw new ValidationError(
        `Listing "${id}" already has the maximum of ${String(MAX_DOCUMENTS_PER_LISTING)} documents`,
      );
    }
    if (input.buffer.length > MAX_DOCUMENT_BYTES) {
      throw new ValidationError(
        `Document exceeds the ${String(MAX_DOCUMENT_BYTES / (1024 * 1024))}MB limit`,
      );
    }
    if (!(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
      throw new ValidationError(
        `Document mime type must be one of ${ALLOWED_DOCUMENT_MIME_TYPES.join(", ")}, received: ${input.mimeType}`,
      );
    }

    const library = this.requireAssetLibrary();
    const extension = extensionFromDocumentMime(input.mimeType);
    const path = `listings/${tenantId}/${id}/doc-${String(Date.now())}.${extension}`;
    const uploaded = await library.assetStorage.upload({
      path,
      fileBody: input.buffer,
      contentType: input.mimeType,
    });
    if (!uploaded.ok) {
      throw uploaded.error;
    }

    const newDocument: ListingDocumentRow = {
      id: randomUUID(),
      filename: input.fileName,
      url: uploaded.value.publicUrl,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.length,
      ...(input.label !== undefined ? { label: input.label } : {}),
      uploadedAt: new Date().toISOString(),
      storagePath: uploaded.value.path,
    };
    const documents = [...row.documents, newDocument];
    const updated = await this.repository.updateById(id, {
      documents,
      updated_at: new Date().toISOString(),
    });
    return toListingDto(updated);
  }

  /**
   * `DELETE /api/v1/listings/:id/documents/:documentId`. Removes the JSONB entry, PLUS a real,
   * best-effort GCS object deletion — unlike `deletePhoto` (which documents that `IAssetStorage`
   * has no delete method and only ever removes the JSONB entry), `GcsStorageClient` DOES implement
   * a real `delete(path)` (see `DeletableAssetStorage`'s docstring above for why it isn't reached
   * through the plain `IAssetStorage` type). The GCS deletion is deliberately best-effort/
   * swallowed-on-failure: the JSONB array is this feature's source of truth for what a listing's
   * document list shows, and a rare orphaned GCS object is a cheap, non-urgent cleanup problem, not
   * worth failing a user-facing delete over.
   */
  async deleteDocument(
    tenantId: string,
    id: string,
    documentId: string,
  ): Promise<ListingResponseDto> {
    const row = await this.requireRow(tenantId, id);
    const target = row.documents.find((d) => d.id === documentId);
    if (target === undefined) {
      throw new NotFoundError(`No document "${documentId}" found on listing "${id}"`);
    }
    const remaining = row.documents.filter((d) => d.id !== documentId);

    if (this.assetLibrary !== undefined) {
      const storage = this.assetLibrary.assetStorage as unknown as Partial<DeletableAssetStorage>;
      if (typeof storage.delete === "function") {
        await storage.delete(target.storagePath).catch(() => undefined);
      }
    }

    const updated = await this.repository.updateById(id, {
      documents: remaining,
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

function extensionFromDocumentMime(mimeType: string): string {
  const map: Readonly<Record<string, string>> = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-excel": "xls",
  };
  return map[mimeType] ?? "bin";
}
