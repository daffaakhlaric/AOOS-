import type { AssetLibrary } from "@aos/asset-library";
import { ok } from "@aos/common";
import { NotFoundError, UnavailableError, ValidationError } from "@aos/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ListingRepository, ListingRow } from "./infrastructure/listing.repository.js";
import { ListingsService } from "./listings.service.js";

const TENANT = "propertyklik-demo";

function makeRow(overrides: Partial<ListingRow> = {}): ListingRow {
  return {
    id: "listing-1",
    tenant_id: TENANT,
    title: "Rumah Bintaro 88m²",
    property_type: "RUMAH",
    listing_status: "AKTIF",
    price: 1_800_000_000,
    branch_id: "BINTARO",
    wa_number: "+628123456789",
    land_area: 88,
    build_area: 70,
    bedrooms: 3,
    bathrooms: 2,
    garage: 1,
    floors: 2,
    certificate: "SHM",
    condition: null,
    electricity: null,
    facing: null,
    address: null,
    city: "Tangerang Selatan",
    province: "Banten",
    postal_code: null,
    description: null,
    highlights: [],
    photos: [],
    main_photo_url: null,
    documents: [],
    in_knowledge_base: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeRepository(): ListingRepository {
  return {
    insert: vi.fn(),
    findById: vi.fn(),
    listByTenant: vi.fn(async () => []),
    updateById: vi.fn(),
    deleteById: vi.fn(async () => undefined),
  } as unknown as ListingRepository;
}

function makeAssetLibrary() {
  return {
    assetStorage: {
      upload: vi.fn(async () => ok({ path: "listings/x", publicUrl: "https://gcs/x.jpg" })),
      getSignedUrl: vi.fn(),
    },
  } as unknown as AssetLibrary;
}

describe("ListingsService", () => {
  let repository: ListingRepository;

  beforeEach(() => {
    repository = makeRepository();
  });

  it("list filters by tenant, status, propertyType, and search", async () => {
    repository.listByTenant = vi.fn(async () => [
      makeRow({ id: "a", title: "Rumah Bintaro", listing_status: "AKTIF", property_type: "RUMAH" }),
      makeRow({
        id: "b",
        title: "Apartemen Cinere",
        listing_status: "DRAFT",
        property_type: "APARTEMEN",
      }),
    ]);
    const service = new ListingsService(repository, undefined);
    const result = await service.list(TENANT, { status: "AKTIF" });
    expect(result.total).toBe(1);
    expect(result.listings[0]?.id).toBe("a");

    const searched = await service.list(TENANT, { search: "cinere" });
    expect(searched.listings[0]?.id).toBe("b");
  });

  it("getById throws NotFoundError for a listing belonging to another tenant", async () => {
    repository.findById = vi.fn(async () => makeRow({ tenant_id: "other-tenant" }));
    const service = new ListingsService(repository, undefined);
    await expect(service.getById(TENANT, "listing-1")).rejects.toThrow(NotFoundError);
  });

  it("create maps the DTO into a snake_case insert and returns the mapped DTO", async () => {
    repository.insert = vi.fn(async (values) => makeRow(values as Partial<ListingRow>));
    const service = new ListingsService(repository, undefined);
    const result = await service.create(TENANT, {
      title: "Rumah Baru",
      propertyType: "RUMAH",
      price: 1_000_000_000,
    });
    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: TENANT,
        title: "Rumah Baru",
        property_type: "RUMAH",
        listing_status: "DRAFT",
        price: 1_000_000_000,
        photos: [],
        in_knowledge_base: false,
      }),
    );
    expect(result.title).toBe("Rumah Baru");
    expect(result.listingStatus).toBe("DRAFT");
  });

  it("update patches only the provided fields", async () => {
    repository.findById = vi.fn(async () => makeRow());
    repository.updateById = vi.fn(async (_id, patch) => makeRow(patch as Partial<ListingRow>));
    const service = new ListingsService(repository, undefined);
    await service.update(TENANT, "listing-1", { price: 2_000_000_000 });
    expect(repository.updateById).toHaveBeenCalledWith(
      "listing-1",
      expect.objectContaining({ price: 2_000_000_000 }),
    );
  });

  it("delete requires the row to belong to the tenant first", async () => {
    repository.findById = vi.fn(async () => undefined);
    const service = new ListingsService(repository, undefined);
    await expect(service.delete(TENANT, "missing")).rejects.toThrow(NotFoundError);
    expect(repository.deleteById).not.toHaveBeenCalled();
  });

  it("addPhoto rejects a 21st photo (spec Part 4's max 20 foto)", async () => {
    const twentyPhotos = Array.from({ length: 20 }, (_, i) => ({
      id: `p${String(i)}`,
      url: `u${String(i)}`,
      order: i,
      isMain: i === 0,
    }));
    repository.findById = vi.fn(async () => makeRow({ photos: twentyPhotos }));
    const service = new ListingsService(repository, makeAssetLibrary());
    await expect(
      service.addPhoto(TENANT, "listing-1", {
        buffer: Buffer.from("x"),
        fileName: "a.jpg",
        mimeType: "image/jpeg",
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("addPhoto throws UnavailableError when no asset library is configured", async () => {
    repository.findById = vi.fn(async () => makeRow());
    const service = new ListingsService(repository, undefined);
    await expect(
      service.addPhoto(TENANT, "listing-1", {
        buffer: Buffer.from("x"),
        fileName: "a.jpg",
        mimeType: "image/jpeg",
      }),
    ).rejects.toThrow(UnavailableError);
  });

  it("addPhoto rejects a disallowed mime type", async () => {
    repository.findById = vi.fn(async () => makeRow());
    const service = new ListingsService(repository, makeAssetLibrary());
    await expect(
      service.addPhoto(TENANT, "listing-1", {
        buffer: Buffer.from("x"),
        fileName: "a.gif",
        mimeType: "image/gif",
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("addPhoto rejects a photo over the 10MB limit", async () => {
    repository.findById = vi.fn(async () => makeRow());
    const service = new ListingsService(repository, makeAssetLibrary());
    await expect(
      service.addPhoto(TENANT, "listing-1", {
        buffer: Buffer.alloc(11 * 1024 * 1024),
        fileName: "a.jpg",
        mimeType: "image/jpeg",
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("addPhoto uploads via the real IAssetStorage adapter, sets the first photo as main, and stores the JSONB entry", async () => {
    repository.findById = vi.fn(async () => makeRow());
    repository.updateById = vi.fn(async (_id, patch) => makeRow(patch as Partial<ListingRow>));
    const library = makeAssetLibrary();
    const service = new ListingsService(repository, library);
    const result = await service.addPhoto(TENANT, "listing-1", {
      buffer: Buffer.from("x"),
      fileName: "a.jpg",
      mimeType: "image/jpeg",
      label: "Tampak depan",
    });
    expect(library.assetStorage.upload).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "image/jpeg" }),
    );
    expect(result.photos).toHaveLength(1);
    expect(result.photos[0]?.isMain).toBe(true);
    expect(result.photos[0]?.label).toBe("Tampak depan");
    expect(result.mainPhotoUrl).toBe("https://gcs/x.jpg");
  });

  it("addPhoto throws the real IAssetStorage error when the upload itself fails", async () => {
    repository.findById = vi.fn(async () => makeRow());
    const library = {
      assetStorage: {
        upload: vi.fn(async () => ({ ok: false, error: new Error("gcs down") })),
        getSignedUrl: vi.fn(),
      },
    } as unknown as AssetLibrary;
    const service = new ListingsService(repository, library);
    await expect(
      service.addPhoto(TENANT, "listing-1", {
        buffer: Buffer.from("x"),
        fileName: "a.jpg",
        mimeType: "image/jpeg",
      }),
    ).rejects.toThrow("gcs down");
  });

  it("addDocument rejects a disallowed mime type", async () => {
    repository.findById = vi.fn(async () => makeRow());
    const service = new ListingsService(repository, makeAssetLibrary());
    await expect(
      service.addDocument(TENANT, "listing-1", {
        buffer: Buffer.from("x"),
        fileName: "a.png",
        mimeType: "image/png",
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("addDocument rejects a document over the 20MB limit", async () => {
    repository.findById = vi.fn(async () => makeRow());
    const service = new ListingsService(repository, makeAssetLibrary());
    await expect(
      service.addDocument(TENANT, "listing-1", {
        buffer: Buffer.alloc(21 * 1024 * 1024),
        fileName: "brosur.pdf",
        mimeType: "application/pdf",
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("addDocument rejects a 21st document (mirrors addPhoto's own MAX_PHOTOS_PER_LISTING precedent)", async () => {
    const twentyDocuments = Array.from({ length: 20 }, (_, i) => ({
      id: `d${String(i)}`,
      filename: `f${String(i)}.pdf`,
      url: `u${String(i)}`,
      mimeType: "application/pdf",
      sizeBytes: 100,
      uploadedAt: "2026-01-01T00:00:00.000Z",
      storagePath: `p${String(i)}`,
    }));
    repository.findById = vi.fn(async () => makeRow({ documents: twentyDocuments }));
    const service = new ListingsService(repository, makeAssetLibrary());
    await expect(
      service.addDocument(TENANT, "listing-1", {
        buffer: Buffer.from("x"),
        fileName: "extra.pdf",
        mimeType: "application/pdf",
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("addDocument throws UnavailableError when no asset library is configured", async () => {
    repository.findById = vi.fn(async () => makeRow());
    const service = new ListingsService(repository, undefined);
    await expect(
      service.addDocument(TENANT, "listing-1", {
        buffer: Buffer.from("x"),
        fileName: "brosur.pdf",
        mimeType: "application/pdf",
      }),
    ).rejects.toThrow(UnavailableError);
  });

  it("addDocument uploads via the real IAssetStorage adapter and stores the JSONB entry", async () => {
    repository.findById = vi.fn(async () => makeRow());
    repository.updateById = vi.fn(async (_id, patch) => makeRow(patch as Partial<ListingRow>));
    const library = makeAssetLibrary();
    const service = new ListingsService(repository, library);
    const result = await service.addDocument(TENANT, "listing-1", {
      buffer: Buffer.from("%PDF-1.4"),
      fileName: "brosur.pdf",
      mimeType: "application/pdf",
      label: "Brosur promo",
    });
    expect(library.assetStorage.upload).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "application/pdf" }),
    );
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]?.filename).toBe("brosur.pdf");
    expect(result.documents[0]?.label).toBe("Brosur promo");
    expect(result.documents[0]?.url).toBe("https://gcs/x.jpg");
  });

  it("deleteDocument removes the JSONB entry and best-effort deletes the real GCS object when the storage exposes delete", async () => {
    const deleteFn = vi.fn(async () => ({ ok: true }));
    repository.findById = vi.fn(async () =>
      makeRow({
        documents: [
          {
            id: "d1",
            filename: "brosur.pdf",
            url: "https://gcs/brosur.pdf",
            mimeType: "application/pdf",
            sizeBytes: 100,
            uploadedAt: "2026-01-01T00:00:00.000Z",
            storagePath: "listings/t/l/doc-1.pdf",
          },
        ],
      }),
    );
    repository.updateById = vi.fn(async (_id, patch) => makeRow(patch as Partial<ListingRow>));
    const library = {
      assetStorage: {
        upload: vi.fn(),
        getSignedUrl: vi.fn(),
        delete: deleteFn,
      },
    } as unknown as AssetLibrary;
    const service = new ListingsService(repository, library);
    const result = await service.deleteDocument(TENANT, "listing-1", "d1");
    expect(deleteFn).toHaveBeenCalledWith("listings/t/l/doc-1.pdf");
    expect(result.documents).toHaveLength(0);
  });

  it("deleteDocument still removes the JSONB entry when the storage has no real delete method", async () => {
    repository.findById = vi.fn(async () =>
      makeRow({
        documents: [
          {
            id: "d1",
            filename: "brosur.pdf",
            url: "https://gcs/brosur.pdf",
            mimeType: "application/pdf",
            sizeBytes: 100,
            uploadedAt: "2026-01-01T00:00:00.000Z",
            storagePath: "listings/t/l/doc-1.pdf",
          },
        ],
      }),
    );
    repository.updateById = vi.fn(async (_id, patch) => makeRow(patch as Partial<ListingRow>));
    const service = new ListingsService(repository, makeAssetLibrary());
    const result = await service.deleteDocument(TENANT, "listing-1", "d1");
    expect(result.documents).toHaveLength(0);
  });

  it("deleteDocument throws NotFoundError for an unknown document id", async () => {
    repository.findById = vi.fn(async () => makeRow({ documents: [] }));
    const service = new ListingsService(repository, undefined);
    await expect(service.deleteDocument(TENANT, "listing-1", "missing")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("reorderPhotos without mainPhotoId keeps each photo's existing isMain flag", async () => {
    repository.findById = vi.fn(async () =>
      makeRow({
        photos: [
          { id: "p1", url: "u1", order: 0, isMain: true },
          { id: "p2", url: "u2", order: 1, isMain: false },
        ],
      }),
    );
    repository.updateById = vi.fn(async (_id, patch) => makeRow(patch as Partial<ListingRow>));
    const service = new ListingsService(repository, undefined);
    const result = await service.reorderPhotos(TENANT, "listing-1", { photoIds: ["p2", "p1"] });
    expect(result.photos.find((p) => p.id === "p1")?.isMain).toBe(true);
    expect(result.photos.find((p) => p.id === "p2")?.isMain).toBe(false);
  });

  it("deletePhoto promotes the next photo to main when the main photo is removed", async () => {
    repository.findById = vi.fn(async () =>
      makeRow({
        photos: [
          { id: "p1", url: "https://gcs/1.jpg", order: 0, isMain: true },
          { id: "p2", url: "https://gcs/2.jpg", order: 1, isMain: false },
        ],
      }),
    );
    repository.updateById = vi.fn(async (_id, patch) => makeRow(patch as Partial<ListingRow>));
    const service = new ListingsService(repository, undefined);
    const result = await service.deletePhoto(TENANT, "listing-1", "p1");
    expect(result.photos).toHaveLength(1);
    expect(result.photos[0]?.id).toBe("p2");
    expect(result.photos[0]?.isMain).toBe(true);
  });

  it("deletePhoto throws NotFoundError for an unknown photo id", async () => {
    repository.findById = vi.fn(async () => makeRow({ photos: [] }));
    const service = new ListingsService(repository, undefined);
    await expect(service.deletePhoto(TENANT, "listing-1", "missing")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("reorderPhotos rejects a photoIds array that isn't a permutation of the existing photos", async () => {
    repository.findById = vi.fn(async () =>
      makeRow({ photos: [{ id: "p1", url: "u1", order: 0, isMain: true }] }),
    );
    const service = new ListingsService(repository, undefined);
    await expect(
      service.reorderPhotos(TENANT, "listing-1", { photoIds: ["p1", "p2"] }),
    ).rejects.toThrow(ValidationError);
  });

  it("reorderPhotos reorders and can set a new main photo in one call", async () => {
    repository.findById = vi.fn(async () =>
      makeRow({
        photos: [
          { id: "p1", url: "u1", order: 0, isMain: true },
          { id: "p2", url: "u2", order: 1, isMain: false },
        ],
      }),
    );
    repository.updateById = vi.fn(async (_id, patch) => makeRow(patch as Partial<ListingRow>));
    const service = new ListingsService(repository, undefined);
    const result = await service.reorderPhotos(TENANT, "listing-1", {
      photoIds: ["p2", "p1"],
      mainPhotoId: "p2",
    });
    expect(result.photos[0]?.id).toBe("p2");
    expect(result.photos[0]?.isMain).toBe(true);
    expect(result.photos[1]?.isMain).toBe(false);
  });

  it("publishKnowledge marks the listing in_knowledge_base=true", async () => {
    repository.findById = vi.fn(async () => makeRow());
    repository.updateById = vi.fn(async (_id, patch) => makeRow(patch as Partial<ListingRow>));
    const service = new ListingsService(repository, undefined);
    const result = await service.publishKnowledge(TENANT, "listing-1");
    expect(result.inKnowledgeBase).toBe(true);
  });

  it("buildPropertyKnowledge only includes listings published to the knowledge base", async () => {
    repository.listByTenant = vi.fn(async () => [
      makeRow({ id: "a", in_knowledge_base: true }),
      makeRow({ id: "b", in_knowledge_base: false }),
    ]);
    const service = new ListingsService(repository, undefined);
    const knowledge = await service.buildPropertyKnowledge(TENANT);
    expect(knowledge.listings).toHaveLength(1);
    expect(knowledge.listings[0]?.id).toBe("a");
  });
});
