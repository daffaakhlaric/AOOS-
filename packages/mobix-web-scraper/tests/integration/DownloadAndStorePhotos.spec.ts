import { AssetType } from "@aos/asset-library";
import { Branch } from "@aos/meta-ads-connector";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { DownloadAndStorePhotos } from "../../src/application/use-cases/DownloadAndStorePhotos.js";
import { ScrapedUnit } from "../../src/domain/entities/ScrapedUnit.js";
import { MobixScraperEvents } from "../../src/domain/events/MobixScraperEvents.js";
import { ScrapedKilometer } from "../../src/domain/value-objects/ScrapedKilometer.js";
import { ScrapedPrice } from "../../src/domain/value-objects/ScrapedPrice.js";
import { ScrapeTimestamp } from "../../src/domain/value-objects/ScrapeTimestamp.js";
import { UnitUrl } from "../../src/domain/value-objects/UnitUrl.js";
import { mswServer } from "../helpers/msw.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { asUploadAsset, createFakeUploadAsset } from "../helpers/uploadAsset.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const clock = () => new Date("2026-08-07T00:00:00.000Z");
const TENANT_ID = "dss-motor";

function unit(photos: string[]): ScrapedUnit {
  const url = UnitUrl.create("https://mobixbydss.id/unit/xpander-cross-2019-abc123");
  const km = ScrapedKilometer.create(45_000);
  const price = ScrapedPrice.create(195_000_000);
  if (!url.ok || !km.ok || !price.ok) throw new Error("fixture setup failed");
  const result = ScrapedUnit.create({
    url: url.value,
    model: "Xpander Cross",
    brand: "Mitsubishi",
    year: 2019,
    transmission: "AT",
    color: "Putih",
    kilometer: km.value,
    price: price.value,
    branch: Branch.BINTARO,
    photos,
    available: true,
    scrapedAt: ScrapeTimestamp.now(clock),
  });
  if (!result.ok) throw new Error("fixture setup failed");
  return result.value;
}

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

describe("DownloadAndStorePhotos (integration, MSW-mocked photo hosts + mocked UploadAsset)", () => {
  it("downloads a photo and uploads it to @aos/asset-library as UNIT_PHOTO", async () => {
    mswServer.use(
      http.get("https://mobixbydss.id/photos/abc123-1.jpg", () =>
        HttpResponse.arrayBuffer(JPEG_BYTES.buffer, {
          headers: { "content-type": "image/jpeg" },
        }),
      ),
    );
    const fakeUploadAsset = createFakeUploadAsset();
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const useCase = new DownloadAndStorePhotos(
      asUploadAsset(fakeUploadAsset),
      events,
      TENANT_ID,
      clock,
    );
    const scrapedUnit = unit(["https://mobixbydss.id/photos/abc123-1.jpg"]);

    const result = await useCase.execute(scrapedUnit, "corr-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.unitIdentityKey).toBe("xpander-cross-2019-abc123");
      expect(result.value.succeeded).toHaveLength(1);
      expect(result.value.failed).toHaveLength(0);
      expect(result.value.succeeded[0]?.assetId).toBe("asset-1");
    }

    expect(fakeUploadAsset.calls).toHaveLength(1);
    const call = fakeUploadAsset.calls[0]!;
    expect(call.type).toBe(AssetType.UNIT_PHOTO);
    expect(call.unitId).toBe("xpander-cross-2019-abc123");
    expect(call.unitModel).toBe("Xpander Cross");
    expect(call.unitYear).toBe(2019);
    expect(call.branch).toBe(Branch.BINTARO);
    expect(call.tenantId).toBe(TENANT_ID);
    expect(call.correlationId).toBe("corr-1");
    expect(call.mimeType).toBe("image/jpeg");
    expect(call.fileName).toBe("abc123-1.jpg");
    expect(Buffer.isBuffer(call.file)).toBe(true);

    const uploaded = publisher.published.find(
      (p) => p.type === "aaos.mobix-scraper.photo.uploaded",
    );
    expect(uploaded).toBeDefined();
    expect(uploaded?.correlationId).toBe("corr-1");
  });

  it("uses the real-time default clock when none is injected", async () => {
    mswServer.use(
      http.get("https://mobixbydss.id/photos/abc123-1.jpg", () =>
        HttpResponse.arrayBuffer(JPEG_BYTES.buffer, {
          headers: { "content-type": "image/jpeg" },
        }),
      ),
    );
    const fakeUploadAsset = createFakeUploadAsset();
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const useCase = new DownloadAndStorePhotos(asUploadAsset(fakeUploadAsset), events, TENANT_ID);
    const scrapedUnit = unit(["https://mobixbydss.id/photos/abc123-1.jpg"]);

    const result = await useCase.execute(scrapedUnit);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.succeeded).toHaveLength(1);
  });

  it("defaults correlationId to the unit's identityKey when none is supplied", async () => {
    mswServer.use(
      http.get("https://mobixbydss.id/photos/abc123-1.jpg", () =>
        HttpResponse.arrayBuffer(JPEG_BYTES.buffer, {
          headers: { "content-type": "image/jpeg" },
        }),
      ),
    );
    const fakeUploadAsset = createFakeUploadAsset();
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const useCase = new DownloadAndStorePhotos(
      asUploadAsset(fakeUploadAsset),
      events,
      TENANT_ID,
      clock,
    );
    const scrapedUnit = unit(["https://mobixbydss.id/photos/abc123-1.jpg"]);

    await useCase.execute(scrapedUnit);

    expect(fakeUploadAsset.calls[0]?.correlationId).toBe("xpander-cross-2019-abc123");
  });

  it("returns an empty succeeded/failed batch for a unit with no photos, without calling UploadAsset", async () => {
    const fakeUploadAsset = createFakeUploadAsset();
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const useCase = new DownloadAndStorePhotos(
      asUploadAsset(fakeUploadAsset),
      events,
      TENANT_ID,
      clock,
    );
    const scrapedUnit = unit([]);

    const result = await useCase.execute(scrapedUnit);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.succeeded).toHaveLength(0);
      expect(result.value.failed).toHaveLength(0);
    }
    expect(fakeUploadAsset.calls).toHaveLength(0);
  });

  it("collects a 403 (CORS-style block) as a per-photo failure without throwing", async () => {
    mswServer.use(
      http.get(
        "https://mobixbydss.id/photos/blocked.jpg",
        () => new HttpResponse(null, { status: 403 }),
      ),
    );
    const fakeUploadAsset = createFakeUploadAsset();
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const useCase = new DownloadAndStorePhotos(
      asUploadAsset(fakeUploadAsset),
      events,
      TENANT_ID,
      clock,
    );
    const scrapedUnit = unit(["https://mobixbydss.id/photos/blocked.jpg"]);

    const result = await useCase.execute(scrapedUnit);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.succeeded).toHaveLength(0);
      expect(result.value.failed).toHaveLength(1);
      expect(result.value.failed[0]?.reason).toMatch(/403/);
    }
    expect(fakeUploadAsset.calls).toHaveLength(0);
  });

  it("collects a network-level fetch error as a per-photo failure", async () => {
    mswServer.use(
      http.get("https://mobixbydss.id/photos/network-error.jpg", () => HttpResponse.error()),
    );
    const fakeUploadAsset = createFakeUploadAsset();
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const useCase = new DownloadAndStorePhotos(
      asUploadAsset(fakeUploadAsset),
      events,
      TENANT_ID,
      clock,
    );
    const scrapedUnit = unit(["https://mobixbydss.id/photos/network-error.jpg"]);

    const result = await useCase.execute(scrapedUnit);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.failed).toHaveLength(1);
      expect(result.value.failed[0]?.reason).toMatch(/fetch failed/);
    }
  });

  it("collects a fetch rejection with a non-Error value as a per-photo failure", async () => {
    const rejectingFetch = (() => Promise.reject("network down")) as unknown as typeof fetch;
    const fakeUploadAsset = createFakeUploadAsset();
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const useCase = new DownloadAndStorePhotos(
      asUploadAsset(fakeUploadAsset),
      events,
      TENANT_ID,
      clock,
      rejectingFetch,
    );
    const scrapedUnit = unit(["https://mobixbydss.id/photos/whatever.jpg"]);

    const result = await useCase.execute(scrapedUnit);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.failed).toHaveLength(1);
      expect(result.value.failed[0]?.reason).toMatch(/fetch failed/);
    }
  });

  it("collects a response-body read failure with a non-Error rejection reason as a per-photo failure", async () => {
    const brokenFetch = (async () =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/jpeg" }),
        arrayBuffer: () => Promise.reject("stream reset"),
      }) as unknown as Response) as typeof fetch;
    const fakeUploadAsset = createFakeUploadAsset();
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const useCase = new DownloadAndStorePhotos(
      asUploadAsset(fakeUploadAsset),
      events,
      TENANT_ID,
      clock,
      brokenFetch,
    );
    const scrapedUnit = unit(["https://mobixbydss.id/photos/broken-body-2.jpg"]);

    const result = await useCase.execute(scrapedUnit);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.failed).toHaveLength(1);
      expect(result.value.failed[0]?.reason).toMatch(/failed to read response body/);
    }
  });

  it("one failed photo does not prevent the rest of the batch from uploading", async () => {
    mswServer.use(
      http.get("https://mobixbydss.id/photos/ok-1.jpg", () =>
        HttpResponse.arrayBuffer(JPEG_BYTES.buffer, { headers: { "content-type": "image/jpeg" } }),
      ),
      http.get(
        "https://mobixbydss.id/photos/bad.jpg",
        () => new HttpResponse(null, { status: 500 }),
      ),
      http.get("https://mobixbydss.id/photos/ok-2.jpg", () =>
        HttpResponse.arrayBuffer(JPEG_BYTES.buffer, { headers: { "content-type": "image/jpeg" } }),
      ),
    );
    const fakeUploadAsset = createFakeUploadAsset();
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const useCase = new DownloadAndStorePhotos(
      asUploadAsset(fakeUploadAsset),
      events,
      TENANT_ID,
      clock,
    );
    const scrapedUnit = unit([
      "https://mobixbydss.id/photos/ok-1.jpg",
      "https://mobixbydss.id/photos/bad.jpg",
      "https://mobixbydss.id/photos/ok-2.jpg",
    ]);

    const result = await useCase.execute(scrapedUnit);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.succeeded).toHaveLength(2);
      expect(result.value.failed).toHaveLength(1);
      expect(result.value.failed[0]?.photoUrl).toBe("https://mobixbydss.id/photos/bad.jpg");
    }
    expect(fakeUploadAsset.calls).toHaveLength(2);
  });

  it("collects an UploadAsset rejection (e.g. invalid input) as a per-photo failure", async () => {
    mswServer.use(
      http.get("https://mobixbydss.id/photos/abc123-1.jpg", () =>
        HttpResponse.arrayBuffer(JPEG_BYTES.buffer, { headers: { "content-type": "image/jpeg" } }),
      ),
    );
    const fakeUploadAsset = createFakeUploadAsset(() => ({
      ok: false,
      error: "UploadAsset: storage quota exceeded",
    }));
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const useCase = new DownloadAndStorePhotos(
      asUploadAsset(fakeUploadAsset),
      events,
      TENANT_ID,
      clock,
    );
    const scrapedUnit = unit(["https://mobixbydss.id/photos/abc123-1.jpg"]);

    const result = await useCase.execute(scrapedUnit);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.succeeded).toHaveLength(0);
      expect(result.value.failed).toHaveLength(1);
      expect(result.value.failed[0]?.reason).toMatch(/storage quota exceeded/);
    }
    const uploaded = publisher.published.find(
      (p) => p.type === "aaos.mobix-scraper.photo.uploaded",
    );
    expect(uploaded).toBeUndefined();
  });

  it("falls back to a generic filename when the photo URL has no usable path segment, and uses the response's content-type header verbatim", async () => {
    mswServer.use(
      http.get("https://mobixbydss.id/", () => HttpResponse.arrayBuffer(JPEG_BYTES.buffer)),
    );
    const fakeUploadAsset = createFakeUploadAsset();
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const useCase = new DownloadAndStorePhotos(
      asUploadAsset(fakeUploadAsset),
      events,
      TENANT_ID,
      clock,
    );
    const scrapedUnit = unit(["https://mobixbydss.id/"]);

    const result = await useCase.execute(scrapedUnit);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.succeeded).toHaveLength(1);
    expect(fakeUploadAsset.calls[0]?.fileName).toBe("photo.jpg");
    // MSW's HttpResponse.arrayBuffer() defaults the Content-Type header to application/octet-stream
    // when none is supplied — the real response header always wins over the URL-extension guess.
    expect(fakeUploadAsset.calls[0]?.mimeType).toBe("application/octet-stream");
  });

  it("falls back to the default mime type for an unrecognized extension with no content-type header", async () => {
    mswServer.use(
      http.get("https://mobixbydss.id/photos/abc123-1.gif", () => {
        const response = new HttpResponse(JPEG_BYTES.buffer);
        response.headers.delete("content-type");
        return response;
      }),
    );
    const fakeUploadAsset = createFakeUploadAsset();
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const useCase = new DownloadAndStorePhotos(
      asUploadAsset(fakeUploadAsset),
      events,
      TENANT_ID,
      clock,
    );
    const scrapedUnit = unit(["https://mobixbydss.id/photos/abc123-1.gif"]);

    const result = await useCase.execute(scrapedUnit);

    expect(result.ok).toBe(true);
    expect(fakeUploadAsset.calls[0]?.mimeType).toBe("image/jpeg");
  });

  it("falls back to the default mime type when the URL has no file extension at all and no content-type header", async () => {
    mswServer.use(
      http.get("https://mobixbydss.id/photos/no-extension", () => {
        const response = new HttpResponse(JPEG_BYTES.buffer);
        response.headers.delete("content-type");
        return response;
      }),
    );
    const fakeUploadAsset = createFakeUploadAsset();
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const useCase = new DownloadAndStorePhotos(
      asUploadAsset(fakeUploadAsset),
      events,
      TENANT_ID,
      clock,
    );
    const scrapedUnit = unit(["https://mobixbydss.id/photos/no-extension"]);

    const result = await useCase.execute(scrapedUnit);

    expect(result.ok).toBe(true);
    expect(fakeUploadAsset.calls[0]?.mimeType).toBe("image/jpeg");
  });

  it("guesses the mime type from the URL extension when the response has no content-type header at all", async () => {
    mswServer.use(
      http.get("https://mobixbydss.id/photos/abc123-1.jpg", () => {
        const response = new HttpResponse(JPEG_BYTES.buffer);
        response.headers.delete("content-type");
        return response;
      }),
    );
    const fakeUploadAsset = createFakeUploadAsset();
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const useCase = new DownloadAndStorePhotos(
      asUploadAsset(fakeUploadAsset),
      events,
      TENANT_ID,
      clock,
    );
    const scrapedUnit = unit(["https://mobixbydss.id/photos/abc123-1.jpg"]);

    const result = await useCase.execute(scrapedUnit);

    expect(result.ok).toBe(true);
    expect(fakeUploadAsset.calls[0]?.mimeType).toBe("image/jpeg");
  });

  it("collects a failure to read the response body (arrayBuffer() rejects) without throwing", async () => {
    const brokenFetch = (async () =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/jpeg" }),
        arrayBuffer: () => Promise.reject(new Error("stream reset")),
      }) as unknown as Response) as typeof fetch;
    const fakeUploadAsset = createFakeUploadAsset();
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const useCase = new DownloadAndStorePhotos(
      asUploadAsset(fakeUploadAsset),
      events,
      TENANT_ID,
      clock,
      brokenFetch,
    );
    const scrapedUnit = unit(["https://mobixbydss.id/photos/broken-body.jpg"]);

    const result = await useCase.execute(scrapedUnit);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.failed).toHaveLength(1);
      expect(result.value.failed[0]?.reason).toMatch(/failed to read response body/);
    }
    expect(fakeUploadAsset.calls).toHaveLength(0);
  });

  it("times out a hanging photo download and records it as a failure", async () => {
    mswServer.use(
      http.get("https://mobixbydss.id/photos/slow.jpg", async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.arrayBuffer(JPEG_BYTES.buffer, {
          headers: { "content-type": "image/jpeg" },
        });
      }),
    );
    const fakeUploadAsset = createFakeUploadAsset();
    const publisher = createFakePublisher();
    const events = new MobixScraperEvents(publisher);
    const useCase = new DownloadAndStorePhotos(
      asUploadAsset(fakeUploadAsset),
      events,
      TENANT_ID,
      clock,
      fetch,
      5,
    );
    const scrapedUnit = unit(["https://mobixbydss.id/photos/slow.jpg"]);

    const result = await useCase.execute(scrapedUnit);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.failed).toHaveLength(1);
      expect(result.value.succeeded).toHaveLength(0);
    }
  });
});
