import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  JOBS_CREATE_TASK_PATH,
  KIE_GENERATION_BASE_URL,
  KieAiGenerationClient,
  VEO_EXTEND_PATH,
  VEO_GENERATE_PATH,
  jobsStatusPath,
} from "../../../src/infrastructure/kie-api/KieAiGenerationClient.js";
import { TokenBucketRateLimiter } from "../../../src/infrastructure/rate-limiter/TokenBucketRateLimiter.js";
import { mswServer } from "../../helpers/msw.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const instantSleep = async (): Promise<void> => undefined;

function makeClient(
  overrides: Partial<ConstructorParameters<typeof KieAiGenerationClient>[0]> = {},
) {
  return new KieAiGenerationClient({
    apiKey: "test-key",
    sleep: instantSleep,
    ...overrides,
  });
}

describe("KieAiGenerationClient", () => {
  it("POST /api/v1/veo/generate (image-to-video) -> taskId", async () => {
    let receivedBody: unknown;
    mswServer.use(
      http.post(`${KIE_GENERATION_BASE_URL}${VEO_GENERATE_PATH}`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_veo_1" } });
      }),
    );
    const client = makeClient();
    const result = unwrap(
      await client.generateVideoFromImage({
        prompt: "A car",
        imageUrls: ["https://cdn.kie.ai/x.jpg"],
        model: "veo3_fast",
        aspect_ratio: "16:9",
        watermark: "",
        enableFallback: false,
        enableTranslation: false,
        generationType: "REFERENCE_2_VIDEO",
      }),
    );
    expect(result.taskId).toBe("task_veo_1");
    expect((receivedBody as { generationType: string }).generationType).toBe("REFERENCE_2_VIDEO");
  });

  it("POST /api/v1/veo/generate (text-to-video) -> taskId", async () => {
    mswServer.use(
      http.post(`${KIE_GENERATION_BASE_URL}${VEO_GENERATE_PATH}`, () =>
        HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_veo_2" } }),
      ),
    );
    const client = makeClient();
    const result = unwrap(
      await client.generateVideoFromText({
        prompt: "Showroom",
        model: "veo3_fast",
        aspect_ratio: "16:9",
        generationType: "TEXT_2_VIDEO",
      }),
    );
    expect(result.taskId).toBe("task_veo_2");
  });

  it("POST /api/v1/veo/extend -> taskId (design resolution #2: the Veo-specific extend endpoint)", async () => {
    let hitPath = "";
    mswServer.use(
      http.post(`${KIE_GENERATION_BASE_URL}${VEO_EXTEND_PATH}`, ({ request }) => {
        hitPath = new URL(request.url).pathname;
        return HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_veo_ext_1" } });
      }),
    );
    const client = makeClient();
    const result = unwrap(await client.extendVideo({ taskId: "task_veo_1", duration: 7 }));
    expect(result.taskId).toBe("task_veo_ext_1");
    expect(hitPath).toBe(VEO_EXTEND_PATH);
  });

  it("POST /api/v1/jobs/createTask (Nano Banana Pro image) -> taskId, never /api/v1/veo/generate", async () => {
    let receivedBody: unknown;
    mswServer.use(
      http.post(`${KIE_GENERATION_BASE_URL}${JOBS_CREATE_TASK_PATH}`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_google_1" } });
      }),
    );
    const client = makeClient();
    const result = unwrap(
      await client.generateImage({
        model: "nano-banana-pro",
        input: {
          prompt: "car photo",
          image_urls: ["https://cdn.kie.ai/x.jpg"],
          output_format: "jpg",
          aspect_ratio: "1:1",
        },
      }),
    );
    expect(result.taskId).toBe("task_google_1");
    expect((receivedBody as { model: string }).model).toBe("nano-banana-pro");
  });

  it("GET /api/v1/jobs/{taskId} -> task status", async () => {
    mswServer.use(
      http.get(`${KIE_GENERATION_BASE_URL}${jobsStatusPath("task_1")}`, () =>
        HttpResponse.json({
          code: 200,
          data: { taskId: "task_1", successFlag: 1, videoUrl: "https://cdn.kie.ai/v.mp4" },
        }),
      ),
    );
    const client = makeClient();
    const result = unwrap(await client.getTaskStatus("task_1"));
    expect(result.successFlag).toBe(1);
    expect(result.videoUrl).toBe("https://cdn.kie.ai/v.mp4");
  });

  it("401 -> KieApiError, never retried", async () => {
    let callCount = 0;
    mswServer.use(
      http.post(`${KIE_GENERATION_BASE_URL}${VEO_GENERATE_PATH}`, () => {
        callCount += 1;
        return new HttpResponse(null, { status: 401 });
      }),
    );
    const client = makeClient();
    const error = unwrapErr(
      await client.generateVideoFromText({
        prompt: "x",
        model: "veo3_fast",
        aspect_ratio: "16:9",
        generationType: "TEXT_2_VIDEO",
      }),
    );
    expect(error.constructor.name).toBe("KieApiError");
    expect(callCount).toBe(1);
  });

  it("429 -> RateLimitError, retried up to 3 times with a 10s wait between attempts, then succeeds", async () => {
    let callCount = 0;
    mswServer.use(
      http.post(`${KIE_GENERATION_BASE_URL}${VEO_GENERATE_PATH}`, () => {
        callCount += 1;
        if (callCount < 3) {
          return new HttpResponse(null, { status: 429 });
        }
        return HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_veo_3" } });
      }),
    );
    const sleepSpy = vi.fn(instantSleep);
    const client = makeClient({ sleep: sleepSpy });
    const result = unwrap(
      await client.generateVideoFromText({
        prompt: "x",
        model: "veo3_fast",
        aspect_ratio: "16:9",
        generationType: "TEXT_2_VIDEO",
      }),
    );
    expect(result.taskId).toBe("task_veo_3");
    expect(callCount).toBe(3);
    expect(sleepSpy).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalledWith(10_000);
  });

  it("429 exhausting all retries returns the last RateLimitError", async () => {
    let callCount = 0;
    mswServer.use(
      http.post(`${KIE_GENERATION_BASE_URL}${VEO_GENERATE_PATH}`, () => {
        callCount += 1;
        return new HttpResponse(null, { status: 429 });
      }),
    );
    const client = makeClient();
    const error = unwrapErr(
      await client.generateVideoFromText({
        prompt: "x",
        model: "veo3_fast",
        aspect_ratio: "16:9",
        generationType: "TEXT_2_VIDEO",
      }),
    );
    expect(error.constructor.name).toBe("RateLimitError");
    expect(callCount).toBe(4); // 1 initial + 3 retries
  });

  it("honors a numeric retry-after header on 429", async () => {
    mswServer.use(
      http.post(
        `${KIE_GENERATION_BASE_URL}${VEO_GENERATE_PATH}`,
        () => new HttpResponse(null, { status: 429, headers: { "retry-after": "5" } }),
      ),
    );
    const client = makeClient({ maxAttempts: 1 });
    const error = unwrapErr(
      await client.generateVideoFromText({
        prompt: "x",
        model: "veo3_fast",
        aspect_ratio: "16:9",
        generationType: "TEXT_2_VIDEO",
      }),
    );
    expect((error as { retryAfterMs: number }).retryAfterMs).toBe(5000);
  });

  it("returns a KieApiError on a network failure", async () => {
    mswServer.use(
      http.post(`${KIE_GENERATION_BASE_URL}${VEO_GENERATE_PATH}`, () => HttpResponse.error()),
    );
    const client = makeClient();
    const error = unwrapErr(
      await client.generateVideoFromText({
        prompt: "x",
        model: "veo3_fast",
        aspect_ratio: "16:9",
        generationType: "TEXT_2_VIDEO",
      }),
    );
    expect(error.message).toMatch(/network failure/);
  });

  it("returns a KieApiError on a non-2xx, non-401, non-429 status", async () => {
    mswServer.use(
      http.post(
        `${KIE_GENERATION_BASE_URL}${VEO_GENERATE_PATH}`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    const client = makeClient();
    const error = unwrapErr(
      await client.generateVideoFromText({
        prompt: "x",
        model: "veo3_fast",
        aspect_ratio: "16:9",
        generationType: "TEXT_2_VIDEO",
      }),
    );
    expect((error as { httpStatus: number }).httpStatus).toBe(500);
  });

  it("returns a KieApiError when the response body is not valid JSON", async () => {
    mswServer.use(
      http.post(
        `${KIE_GENERATION_BASE_URL}${VEO_GENERATE_PATH}`,
        () => new HttpResponse("not json", { status: 200 }),
      ),
    );
    const client = makeClient();
    const error = unwrapErr(
      await client.generateVideoFromText({
        prompt: "x",
        model: "veo3_fast",
        aspect_ratio: "16:9",
        generationType: "TEXT_2_VIDEO",
      }),
    );
    expect(error.message).toMatch(/not valid JSON/);
  });

  it("handles a non-Error value thrown by fetch (network failure)", async () => {
    const throwingFetch = (async () => {
      throw "raw string rejection";
    }) as unknown as typeof fetch;
    const client = makeClient({ fetchImpl: throwingFetch });
    const error = unwrapErr(
      await client.generateVideoFromText({
        prompt: "x",
        model: "veo3_fast",
        aspect_ratio: "16:9",
        generationType: "TEXT_2_VIDEO",
      }),
    );
    expect(error.message).toMatch(/network failure/);
    expect((error as { cause?: unknown }).cause).toBeUndefined();
  });

  it("handles a non-Error value thrown while parsing the response body", async () => {
    const brokenFetch = (async () =>
      ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => {
          // eslint-disable-next-line @typescript-eslint/no-throw-literal
          throw "raw string rejection";
        },
      }) as unknown as Response) as typeof fetch;
    const client = makeClient({ fetchImpl: brokenFetch });
    const error = unwrapErr(
      await client.generateVideoFromText({
        prompt: "x",
        model: "veo3_fast",
        aspect_ratio: "16:9",
        generationType: "TEXT_2_VIDEO",
      }),
    );
    expect(error.message).toMatch(/not valid JSON/);
    expect((error as { cause?: unknown }).cause).toBeUndefined();
  });

  it("returns a RateLimitError immediately when the local token bucket is exhausted, without an HTTP call", async () => {
    let callCount = 0;
    mswServer.use(
      http.post(`${KIE_GENERATION_BASE_URL}${VEO_GENERATE_PATH}`, () => {
        callCount += 1;
        return HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_x" } });
      }),
    );
    const exhaustedLimiter = new TokenBucketRateLimiter({ now: () => 0 });
    for (let i = 0; i < 20; i += 1) {
      exhaustedLimiter.tryConsume();
    }
    const client = makeClient({ rateLimiter: exhaustedLimiter });
    const error = unwrapErr(
      await client.generateVideoFromText({
        prompt: "x",
        model: "veo3_fast",
        aspect_ratio: "16:9",
        generationType: "TEXT_2_VIDEO",
      }),
    );
    expect(error.constructor.name).toBe("RateLimitError");
    expect(callCount).toBe(0);
  });

  it("sends Content-Type application/json on POST requests", async () => {
    let receivedContentType: string | null = null;
    mswServer.use(
      http.post(`${KIE_GENERATION_BASE_URL}${VEO_GENERATE_PATH}`, ({ request }) => {
        receivedContentType = request.headers.get("content-type");
        return HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_x" } });
      }),
    );
    const client = makeClient();
    await client.generateVideoFromText({
      prompt: "x",
      model: "veo3_fast",
      aspect_ratio: "16:9",
      generationType: "TEXT_2_VIDEO",
    });
    expect(receivedContentType).toBe("application/json");
  });

  it("uses a real setTimeout-based sleep by default", async () => {
    mswServer.use(
      http.post(`${KIE_GENERATION_BASE_URL}${VEO_GENERATE_PATH}`, () =>
        HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_x" } }),
      ),
    );
    const client = new KieAiGenerationClient({ apiKey: "k" });
    const result = unwrap(
      await client.generateVideoFromText({
        prompt: "x",
        model: "veo3_fast",
        aspect_ratio: "16:9",
        generationType: "TEXT_2_VIDEO",
      }),
    );
    expect(result.taskId).toBe("task_x");
  });

  it("the default (real setTimeout-based) sleep actually waits during a 429 retry", async () => {
    vi.useFakeTimers();
    try {
      let callCount = 0;
      mswServer.use(
        http.post(`${KIE_GENERATION_BASE_URL}${VEO_GENERATE_PATH}`, () => {
          callCount += 1;
          if (callCount === 1) {
            return new HttpResponse(null, { status: 429 });
          }
          return HttpResponse.json({ code: 200, msg: "success", data: { taskId: "task_retry" } });
        }),
      );
      const client = new KieAiGenerationClient({ apiKey: "k" });
      const pending = client.generateVideoFromText({
        prompt: "x",
        model: "veo3_fast",
        aspect_ratio: "16:9",
        generationType: "TEXT_2_VIDEO",
      });
      await vi.advanceTimersByTimeAsync(10_000);
      const result = unwrap(await pending);
      expect(result.taskId).toBe("task_retry");
      expect(callCount).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to the default retry-after when the header is a non-numeric, non-date string", async () => {
    mswServer.use(
      http.post(
        `${KIE_GENERATION_BASE_URL}${VEO_GENERATE_PATH}`,
        () => new HttpResponse(null, { status: 429, headers: { "retry-after": "not-a-number" } }),
      ),
    );
    const client = makeClient({ maxAttempts: 1 });
    const error = unwrapErr(
      await client.generateVideoFromText({
        prompt: "x",
        model: "veo3_fast",
        aspect_ratio: "16:9",
        generationType: "TEXT_2_VIDEO",
      }),
    );
    expect((error as { retryAfterMs: number }).retryAfterMs).toBe(10_000);
  });

  it("falls back to the default retry-after when no header is present", async () => {
    mswServer.use(
      http.post(
        `${KIE_GENERATION_BASE_URL}${VEO_GENERATE_PATH}`,
        () => new HttpResponse(null, { status: 429 }),
      ),
    );
    const client = makeClient({ maxAttempts: 1 });
    const error = unwrapErr(
      await client.generateVideoFromText({
        prompt: "x",
        model: "veo3_fast",
        aspect_ratio: "16:9",
        generationType: "TEXT_2_VIDEO",
      }),
    );
    expect((error as { retryAfterMs: number }).retryAfterMs).toBe(10_000);
  });
});
