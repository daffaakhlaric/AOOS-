import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  KIE_FILE_UPLOAD_BASE_URL,
  KieAiFileUploadClient,
} from "../../../src/infrastructure/kie-api/KieAiFileUploadClient.js";
import { mswServer } from "../../helpers/msw.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const UPLOAD_URL = `${KIE_FILE_UPLOAD_BASE_URL}/api/file-stream-upload`;

function makeClient(): KieAiFileUploadClient {
  return new KieAiFileUploadClient({
    apiKey: "test-key",
    now: () => new Date("2026-01-01T00:00:00Z"),
  });
}

describe("KieAiFileUploadClient", () => {
  it("uploads via a real multipart/form-data POST (not JSON) and returns fileId + fileUrl", async () => {
    let receivedContentType: string | null = null;
    let receivedFields: Record<string, string> = {};
    mswServer.use(
      http.post(UPLOAD_URL, async ({ request }) => {
        receivedContentType = request.headers.get("content-type");
        const form = await request.formData();
        receivedFields = {
          uploadPath: String(form.get("uploadPath")),
          fileName: String(form.get("fileName")),
        };
        return HttpResponse.json({
          success: true,
          code: 200,
          msg: "File upload successful",
          data: {
            fileId: "file_abc1234",
            fileUrl: "https://cdn.kie.ai/images/aaos-dss/xpander-bintaro-001.jpg",
          },
        });
      }),
    );

    const client = makeClient();
    const file = unwrap(
      await client.upload(Buffer.from("fake-image-bytes"), "xpander-bintaro-001.jpg", "image/jpeg"),
    );

    expect(file.fileId.toString()).toBe("file_abc1234");
    expect(file.fileUrl.toString()).toBe(
      "https://cdn.kie.ai/images/aaos-dss/xpander-bintaro-001.jpg",
    );
    expect(receivedContentType).toMatch(/^multipart\/form-data/);
    expect(receivedFields.uploadPath).toBe("images/aaos-dss");
    expect(receivedFields.fileName).toBe("xpander-bintaro-001.jpg");
  });

  it("sends the Authorization bearer header", async () => {
    let receivedAuth: string | null = null;
    mswServer.use(
      http.post(UPLOAD_URL, ({ request }) => {
        receivedAuth = request.headers.get("authorization");
        return HttpResponse.json({
          success: true,
          code: 200,
          msg: "ok",
          data: { fileId: "file_1", fileUrl: "https://cdn.kie.ai/a.jpg" },
        });
      }),
    );
    const client = makeClient();
    await client.upload(Buffer.from("x"), "a.jpg", "image/jpeg");
    expect(receivedAuth).toBe("Bearer test-key");
  });

  it("accepts a custom uploadPath", async () => {
    let receivedUploadPath: string | null = null;
    mswServer.use(
      http.post(UPLOAD_URL, async ({ request }) => {
        const form = await request.formData();
        receivedUploadPath = String(form.get("uploadPath"));
        return HttpResponse.json({
          success: true,
          code: 200,
          msg: "ok",
          data: { fileId: "file_1", fileUrl: "https://cdn.kie.ai/a.jpg" },
        });
      }),
    );
    const client = makeClient();
    await client.upload(Buffer.from("x"), "a.jpg", "image/jpeg", "custom/path");
    expect(receivedUploadPath).toBe("custom/path");
  });

  it("rejects an unsupported mime type without making any HTTP call", async () => {
    const client = makeClient();
    const error = unwrapErr(await client.upload(Buffer.from("x"), "a.gif", "image/gif" as never));
    expect(error.message).toMatch(/unsupported mime type/);
  });

  it("returns FileUploadError on a network failure", async () => {
    mswServer.use(http.post(UPLOAD_URL, () => HttpResponse.error()));
    const client = makeClient();
    const error = unwrapErr(await client.upload(Buffer.from("x"), "a.jpg", "image/jpeg"));
    expect(error.message).toMatch(/network failure/);
  });

  it("handles a non-Error value thrown by fetch (network failure)", async () => {
    const throwingFetch = (async () => {
      throw "raw string rejection";
    }) as unknown as typeof fetch;
    const client = new KieAiFileUploadClient({ apiKey: "k", fetchImpl: throwingFetch });
    const error = unwrapErr(await client.upload(Buffer.from("x"), "a.jpg", "image/jpeg"));
    expect(error.message).toMatch(/network failure/);
    expect(error.cause).toBeUndefined();
  });

  it("handles a non-Error value thrown while parsing the response body", async () => {
    const brokenFetch = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          // eslint-disable-next-line @typescript-eslint/no-throw-literal
          throw "raw string rejection";
        },
      }) as unknown as Response) as typeof fetch;
    const client = new KieAiFileUploadClient({ apiKey: "k", fetchImpl: brokenFetch });
    const error = unwrapErr(await client.upload(Buffer.from("x"), "a.jpg", "image/jpeg"));
    expect(error.message).toMatch(/not valid JSON/);
    expect(error.cause).toBeUndefined();
  });

  it("returns FileUploadError on a non-2xx HTTP status", async () => {
    mswServer.use(http.post(UPLOAD_URL, () => new HttpResponse(null, { status: 500 })));
    const client = makeClient();
    const error = unwrapErr(await client.upload(Buffer.from("x"), "a.jpg", "image/jpeg"));
    expect(error.message).toMatch(/HTTP 500/);
  });

  it("returns FileUploadError when success:false is returned", async () => {
    mswServer.use(
      http.post(UPLOAD_URL, () =>
        HttpResponse.json({ success: false, code: 400, msg: "invalid file" }),
      ),
    );
    const client = makeClient();
    const error = unwrapErr(await client.upload(Buffer.from("x"), "a.jpg", "image/jpeg"));
    expect(error.message).toMatch(/invalid file/);
  });

  it("returns FileUploadError when the response body is not valid JSON", async () => {
    mswServer.use(http.post(UPLOAD_URL, () => new HttpResponse("not json", { status: 200 })));
    const client = makeClient();
    const error = unwrapErr(await client.upload(Buffer.from("x"), "a.jpg", "image/jpeg"));
    expect(error.message).toMatch(/not valid JSON/);
  });

  it("returns FileUploadError when the returned fileId is empty", async () => {
    mswServer.use(
      http.post(UPLOAD_URL, () =>
        HttpResponse.json({
          success: true,
          code: 200,
          msg: "ok",
          data: { fileId: "", fileUrl: "https://cdn.kie.ai/a.jpg" },
        }),
      ),
    );
    const client = makeClient();
    const error = unwrapErr(await client.upload(Buffer.from("x"), "a.jpg", "image/jpeg"));
    expect(error.message).toMatch(/non-empty string/);
  });

  it("returns FileUploadError when the caller-supplied fileName is empty", async () => {
    mswServer.use(
      http.post(UPLOAD_URL, () =>
        HttpResponse.json({
          success: true,
          code: 200,
          msg: "ok",
          data: { fileId: "file_1", fileUrl: "https://cdn.kie.ai/a.jpg" },
        }),
      ),
    );
    const client = makeClient();
    const error = unwrapErr(await client.upload(Buffer.from("x"), "", "image/jpeg"));
    expect(error.message).toMatch(/fileName must be a non-empty string/);
  });

  it("returns FileUploadError when the returned fileUrl is malformed", async () => {
    mswServer.use(
      http.post(UPLOAD_URL, () =>
        HttpResponse.json({
          success: true,
          code: 200,
          msg: "ok",
          data: { fileId: "file_1", fileUrl: "not-a-url" },
        }),
      ),
    );
    const client = makeClient();
    const error = unwrapErr(await client.upload(Buffer.from("x"), "a.jpg", "image/jpeg"));
    expect(error.message).toMatch(/absolute http\(s\) URL/);
  });

  it("defaults `now` to the real wall clock when not injected", async () => {
    mswServer.use(
      http.post(UPLOAD_URL, () =>
        HttpResponse.json({
          success: true,
          code: 200,
          msg: "ok",
          data: { fileId: "file_1", fileUrl: "https://cdn.kie.ai/a.jpg" },
        }),
      ),
    );
    const client = new KieAiFileUploadClient({ apiKey: "k" });
    const before = Date.now();
    const file = unwrap(await client.upload(Buffer.from("x"), "a.jpg", "image/jpeg"));
    expect(file.uploadedAt.getTime()).toBeGreaterThanOrEqual(before);
  });
});
