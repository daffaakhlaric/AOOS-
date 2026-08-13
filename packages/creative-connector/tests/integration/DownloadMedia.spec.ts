import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { DownloadMedia } from "../../src/application/use-cases/DownloadMedia.js";
import { MediaUrl } from "../../src/domain/value-objects/MediaUrl.js";
import { mswServer } from "../helpers/msw.js";
import { unwrap, unwrapErr } from "../helpers/result.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const MEDIA_URL = "https://cdn.kie.ai/videos/out.mp4";

describe("DownloadMedia (integration, MSW-mocked cdn.kie.ai)", () => {
  it("videoUrl -> fetch -> Buffer", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    mswServer.use(http.get(MEDIA_URL, () => new HttpResponse(bytes)));
    const useCase = new DownloadMedia();
    const buffer = unwrap(await useCase.execute(MEDIA_URL));
    expect(Buffer.compare(buffer, Buffer.from(bytes))).toBe(0);
  });

  it("accepts a MediaUrl value object directly", async () => {
    const bytes = new Uint8Array([9]);
    mswServer.use(http.get(MEDIA_URL, () => new HttpResponse(bytes)));
    const useCase = new DownloadMedia();
    const url = unwrap(MediaUrl.create(MEDIA_URL));
    const buffer = unwrap(await useCase.execute(url));
    expect(buffer.length).toBe(1);
  });

  it("404 -> error (file expired after 14 days)", async () => {
    mswServer.use(http.get(MEDIA_URL, () => new HttpResponse(null, { status: 404 })));
    const useCase = new DownloadMedia();
    const error = unwrapErr(await useCase.execute(MEDIA_URL));
    expect(error.httpStatus).toBe(404);
  });

  it("returns a KieApiError on a network failure", async () => {
    mswServer.use(http.get(MEDIA_URL, () => HttpResponse.error()));
    const useCase = new DownloadMedia();
    const error = unwrapErr(await useCase.execute(MEDIA_URL));
    expect(error.message).toMatch(/network failure/);
  });

  it("returns a KieApiError when reading the response body fails", async () => {
    const brokenFetch = (async () =>
      ({
        ok: true,
        status: 200,
        arrayBuffer: async () => {
          throw new Error("stream interrupted");
        },
      }) as unknown as Response) as typeof fetch;
    const useCase = new DownloadMedia(brokenFetch);
    const error = unwrapErr(await useCase.execute(MEDIA_URL));
    expect(error.message).toMatch(/failed to read response body/);
  });

  it("uses the default timeout and fetch when not injected", async () => {
    const bytes = new Uint8Array([1]);
    mswServer.use(http.get(MEDIA_URL, () => new HttpResponse(bytes)));
    const useCase = new DownloadMedia(fetch);
    const buffer = unwrap(await useCase.execute(MEDIA_URL));
    expect(buffer.length).toBe(1);
  });

  it("handles a non-Error value thrown by fetch (network failure)", async () => {
    const throwingFetch = (async () => {
      throw "raw string rejection";
    }) as unknown as typeof fetch;
    const useCase = new DownloadMedia(throwingFetch);
    const error = unwrapErr(await useCase.execute(MEDIA_URL));
    expect(error.message).toMatch(/network failure/);
    expect(error.cause).toBeUndefined();
  });

  it("handles a non-Error value thrown while reading the response body", async () => {
    const brokenFetch = (async () =>
      ({
        ok: true,
        status: 200,
        arrayBuffer: async () => {
          // eslint-disable-next-line @typescript-eslint/no-throw-literal
          throw "raw string rejection";
        },
      }) as unknown as Response) as typeof fetch;
    const useCase = new DownloadMedia(brokenFetch);
    const error = unwrapErr(await useCase.execute(MEDIA_URL));
    expect(error.message).toMatch(/failed to read response body/);
    expect(error.cause).toBeUndefined();
  });
});
