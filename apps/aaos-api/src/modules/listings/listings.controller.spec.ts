import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import type { ListingResponseDto } from "./dto/listing.dto.js";
import { ListingsController } from "./listings.controller.js";
import type { ListingsService } from "./listings.service.js";

const LISTING_SAMPLE: ListingResponseDto = {
  id: "listing-1",
  title: "Rumah Bintaro",
  propertyType: "RUMAH",
  listingStatus: "AKTIF",
  price: 1_800_000_000,
  highlights: [],
  photos: [],
  documents: [],
  inKnowledgeBase: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function buildFakeService(): ListingsService {
  return {
    list: vi.fn(async () => ({ listings: [LISTING_SAMPLE], total: 1 })),
    getById: vi.fn(async () => LISTING_SAMPLE),
    create: vi.fn(async () => LISTING_SAMPLE),
    update: vi.fn(async () => LISTING_SAMPLE),
    delete: vi.fn(async () => undefined),
    addPhoto: vi.fn(async () => LISTING_SAMPLE),
    deletePhoto: vi.fn(async () => LISTING_SAMPLE),
    addDocument: vi.fn(async () => LISTING_SAMPLE),
    deleteDocument: vi.fn(async () => LISTING_SAMPLE),
    reorderPhotos: vi.fn(async () => LISTING_SAMPLE),
    publishKnowledge: vi.fn(async () => ({ ...LISTING_SAMPLE, inKnowledgeBase: true })),
  } as unknown as ListingsService;
}

function fakeMultipartRequest(
  part:
    | {
        filename: string;
        mimetype: string;
        buffer: Buffer;
        label?: string;
      }
    | undefined,
) {
  return {
    file: vi.fn(async () =>
      part === undefined
        ? undefined
        : {
            filename: part.filename,
            mimetype: part.mimetype,
            toBuffer: async () => part.buffer,
            fields: part.label !== undefined ? { label: { type: "field", value: part.label } } : {},
          },
    ),
  } as unknown as Parameters<ListingsController["uploadPhoto"]>[2];
}

describe("ListingsController", () => {
  it("GET /api/v1/listings delegates to service.list", async () => {
    const service = buildFakeService();
    const controller = new ListingsController(service);
    const result = await controller.list("dss-motor", {});
    expect(service.list).toHaveBeenCalledWith("dss-motor", {});
    expect(result.total).toBe(1);
  });

  it("POST /api/v1/listings delegates to service.create", async () => {
    const service = buildFakeService();
    const controller = new ListingsController(service);
    const body = { title: "Rumah Baru", propertyType: "RUMAH" as const, price: 1_000_000_000 };
    await controller.create("dss-motor", body);
    expect(service.create).toHaveBeenCalledWith("dss-motor", body);
  });

  it("GET /api/v1/listings/:id delegates to service.getById", async () => {
    const service = buildFakeService();
    const controller = new ListingsController(service);
    await controller.byId("dss-motor", "listing-1");
    expect(service.getById).toHaveBeenCalledWith("dss-motor", "listing-1");
  });

  it("PUT /api/v1/listings/:id delegates to service.update", async () => {
    const service = buildFakeService();
    const controller = new ListingsController(service);
    await controller.update("dss-motor", "listing-1", { price: 2_000_000_000 });
    expect(service.update).toHaveBeenCalledWith("dss-motor", "listing-1", {
      price: 2_000_000_000,
    });
  });

  it("DELETE /api/v1/listings/:id delegates to service.delete", async () => {
    const service = buildFakeService();
    const controller = new ListingsController(service);
    const result = await controller.remove("dss-motor", "listing-1");
    expect(service.delete).toHaveBeenCalledWith("dss-motor", "listing-1");
    expect(result).toEqual({ deleted: true });
  });

  it("POST /api/v1/listings/:id/photos reads the multipart file + label field and delegates to service.addPhoto", async () => {
    const service = buildFakeService();
    const controller = new ListingsController(service);
    const buffer = Buffer.from("fake-image-bytes");
    const request = fakeMultipartRequest({
      filename: "front.jpg",
      mimetype: "image/jpeg",
      buffer,
      label: "Tampak depan",
    });
    await controller.uploadPhoto("dss-motor", "listing-1", request);
    expect(service.addPhoto).toHaveBeenCalledWith("dss-motor", "listing-1", {
      buffer,
      fileName: "front.jpg",
      mimeType: "image/jpeg",
      label: "Tampak depan",
    });
  });

  it("POST /api/v1/listings/:id/photos omits label when the multipart request carries no label field", async () => {
    const service = buildFakeService();
    const controller = new ListingsController(service);
    const buffer = Buffer.from("fake-image-bytes");
    const request = fakeMultipartRequest({ filename: "front.jpg", mimetype: "image/jpeg", buffer });
    await controller.uploadPhoto("dss-motor", "listing-1", request);
    expect(service.addPhoto).toHaveBeenCalledWith("dss-motor", "listing-1", {
      buffer,
      fileName: "front.jpg",
      mimeType: "image/jpeg",
    });
  });

  it("POST /api/v1/listings/:id/photos throws when the request carries no file part", async () => {
    const service = buildFakeService();
    const controller = new ListingsController(service);
    const request = fakeMultipartRequest(undefined);
    await expect(controller.uploadPhoto("dss-motor", "listing-1", request)).rejects.toThrow();
    expect(service.addPhoto).not.toHaveBeenCalled();
  });

  it("DELETE /api/v1/listings/:id/photos/:photoId delegates to service.deletePhoto", async () => {
    const service = buildFakeService();
    const controller = new ListingsController(service);
    await controller.deletePhoto("dss-motor", "listing-1", "photo-1");
    expect(service.deletePhoto).toHaveBeenCalledWith("dss-motor", "listing-1", "photo-1");
  });

  it("POST /api/v1/listings/:id/documents reads the multipart file + label field and delegates to service.addDocument", async () => {
    const service = buildFakeService();
    const controller = new ListingsController(service);
    const buffer = Buffer.from("fake-pdf-bytes");
    const request = fakeMultipartRequest({
      filename: "brosur.pdf",
      mimetype: "application/pdf",
      buffer,
      label: "Brosur promo",
    }) as unknown as Parameters<ListingsController["uploadDocument"]>[2];
    await controller.uploadDocument("dss-motor", "listing-1", request);
    expect(service.addDocument).toHaveBeenCalledWith("dss-motor", "listing-1", {
      buffer,
      fileName: "brosur.pdf",
      mimeType: "application/pdf",
      label: "Brosur promo",
    });
  });

  it("POST /api/v1/listings/:id/documents omits label when the multipart request carries no label field", async () => {
    const service = buildFakeService();
    const controller = new ListingsController(service);
    const buffer = Buffer.from("fake-pdf-bytes");
    const request = fakeMultipartRequest({
      filename: "brosur.pdf",
      mimetype: "application/pdf",
      buffer,
    }) as unknown as Parameters<ListingsController["uploadDocument"]>[2];
    await controller.uploadDocument("dss-motor", "listing-1", request);
    expect(service.addDocument).toHaveBeenCalledWith("dss-motor", "listing-1", {
      buffer,
      fileName: "brosur.pdf",
      mimeType: "application/pdf",
    });
  });

  it("POST /api/v1/listings/:id/documents throws when the request carries no file part", async () => {
    const service = buildFakeService();
    const controller = new ListingsController(service);
    const request = fakeMultipartRequest(undefined) as unknown as Parameters<
      ListingsController["uploadDocument"]
    >[2];
    await expect(controller.uploadDocument("dss-motor", "listing-1", request)).rejects.toThrow();
    expect(service.addDocument).not.toHaveBeenCalled();
  });

  it("DELETE /api/v1/listings/:id/documents/:documentId delegates to service.deleteDocument", async () => {
    const service = buildFakeService();
    const controller = new ListingsController(service);
    await controller.deleteDocument("dss-motor", "listing-1", "doc-1");
    expect(service.deleteDocument).toHaveBeenCalledWith("dss-motor", "listing-1", "doc-1");
  });

  it("PUT /api/v1/listings/:id/photos/reorder delegates to service.reorderPhotos", async () => {
    const service = buildFakeService();
    const controller = new ListingsController(service);
    const body = { photoIds: ["p2", "p1"] };
    await controller.reorderPhotos("dss-motor", "listing-1", body);
    expect(service.reorderPhotos).toHaveBeenCalledWith("dss-motor", "listing-1", body);
  });

  it("POST /api/v1/listings/:id/publish-knowledge delegates to service.publishKnowledge", async () => {
    const service = buildFakeService();
    const controller = new ListingsController(service);
    const result = await controller.publishKnowledge("dss-motor", "listing-1");
    expect(service.publishKnowledge).toHaveBeenCalledWith("dss-motor", "listing-1");
    expect(result.inKnowledgeBase).toBe(true);
  });

  it("guards the whole controller with ApiKeyGuard", () => {
    const guards = Reflect.getMetadata("__guards__", ListingsController) as unknown[];
    expect(guards).toContain(ApiKeyGuard);
  });
});
