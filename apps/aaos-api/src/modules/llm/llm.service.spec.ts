import { err, ok, type Result } from "@aos/common";
import {
  RateLimitError,
  TokenBucketRateLimiter,
  type IRateLimiter,
  type RateLimitStatus,
} from "@aos/meta-ads-connector";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { buildTestConfig } from "../../test-support/fixtures.js";
import {
  mswServer,
  registerOpenAiChatHandler,
  registerOpenAiErrorHandler,
} from "../../test-support/openai-msw.js";

import { ResponseCache } from "./cache/ResponseCache.js";
import type { AnalyzeRequestDto } from "./dto/analyze.dto.js";
import type { CreativeBriefRequestDto } from "./dto/creative-brief.dto.js";
import {
  CHAT_COMPLETIONS_PATH,
  OPENAI_BASE_URL,
  OpenAiClient,
} from "./infrastructure/OpenAiClient.js";
import { LlmService } from "./llm.service.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

/** Always fails to consume, for RATE_LIMITED-path tests — a `RateLimitError` cast is not needed since `LlmService` only branches on `.ok`, never inspects `.error`. */
class AlwaysRateLimitedLimiter implements IRateLimiter {
  tryConsume(): Result<void, RateLimitError> {
    return err(new RateLimitError("exhausted", 1000));
  }
  getRateLimitStatus(): RateLimitStatus {
    return { remaining: 0, resetAt: new Date(0) };
  }
  notifyRateLimited(): void {
    // no-op
  }
}

class AlwaysAllowedLimiter implements IRateLimiter {
  tryConsume(): Result<void, RateLimitError> {
    return ok(undefined);
  }
  getRateLimitStatus(): RateLimitStatus {
    return { remaining: 10, resetAt: new Date(0) };
  }
  notifyRateLimited(): void {
    // no-op
  }
}

function buildService(
  overrides: {
    readonly apiKey?: string;
    readonly rateLimiter?: IRateLimiter;
    readonly cache?: ResponseCache<unknown>;
  } = {},
): LlmService {
  const config = buildTestConfig({ OPENAI_API_KEY: overrides.apiKey ?? "test-openai-key" });
  const client = new OpenAiClient({ apiKey: config.OPENAI_API_KEY });
  const rateLimiter = overrides.rateLimiter ?? new AlwaysAllowedLimiter();
  const cache = overrides.cache ?? new ResponseCache<unknown>();
  return new LlmService(config, client, rateLimiter, cache);
}

const validAnalyzeBody: AnalyzeRequestDto = {
  campaigns: [
    {
      id: "campaign-1",
      stableId: "stable-1",
      metaId: "meta-1",
      name: "Campaign 1",
      objective: "OUTCOME_LEADS",
      status: "ACTIVE",
      funnel: "MAAO2",
      branch: "BINTARO",
      spend: 500000,
      createdAt: "2026-01-01T00:00:00.000Z",
      adSets: [],
    },
  ],
};

const validAnalyzeLlmJson = JSON.stringify({
  temuan: [{ icon: "🔴", judul: "Frekuensi tinggi", detail: "Audience jenuh" }],
  rekomendasi: [
    {
      aksi: "SCALE",
      target: "#C001 nama iklan",
      alasan: "performa bagus",
      estimasi: "hemat Rp 500rb",
    },
  ],
  ringkasan: "Kondisi iklan cukup baik secara umum.",
});

const validCreativeBriefBody: CreativeBriefRequestDto = {
  ad: { name: "Xpander Ultimate" },
  branch: "BINTARO",
};

const validCreativeBriefLlmJson = JSON.stringify({
  unit: "Xpander Ultimate",
  angle: "DP_RINGAN",
  branch: "BINTARO",
  primaryMessage: "DP mulai 20 juta langsung bisa bawa pulang",
  tone: "casual, relatable",
  formats: ["VIDEO_15S", "IMAGE_SQUARE"],
  avoid: ["terlalu banyak text"],
  urgency: "HIGH",
});

describe("LlmService", () => {
  describe("analyze", () => {
    it("returns NO_API_KEY when OPENAI_API_KEY is empty, without consuming rate-limit budget", async () => {
      const rateLimiter = new AlwaysAllowedLimiter();
      const consumeSpy = vi.spyOn(rateLimiter, "tryConsume");
      const service = buildService({ apiKey: "", rateLimiter });
      const result = await service.analyze(validAnalyzeBody);
      expect(result).toEqual({
        available: false,
        reason: "NO_API_KEY",
        message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
      });
      expect(consumeSpy).not.toHaveBeenCalled();
    });

    it("returns RATE_LIMITED when the local budget is exhausted", async () => {
      const service = buildService({ rateLimiter: new AlwaysRateLimitedLimiter() });
      const result = await service.analyze(validAnalyzeBody);
      expect(result).toEqual({
        available: false,
        reason: "RATE_LIMITED",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns a validated available:true payload on a well-formed OpenAI response, and caches it", async () => {
      registerOpenAiChatHandler(validAnalyzeLlmJson);
      const cache = new ResponseCache<unknown>();
      const service = buildService({ cache });

      const first = await service.analyze(validAnalyzeBody);
      expect(first).toEqual({ available: true, ...JSON.parse(validAnalyzeLlmJson) });

      // Second identical call must be served from cache — deregister every handler so a real
      // second network call would fail under onUnhandledRequest: "error" if the cache didn't work.
      mswServer.resetHandlers();
      const second = await service.analyze(validAnalyzeBody);
      expect(second).toEqual(first);
    });

    it("returns PROVIDER_ERROR when the OpenAI call fails (non-2xx)", async () => {
      registerOpenAiErrorHandler(500);
      const service = buildService();
      const result = await service.analyze(validAnalyzeBody);
      expect(result).toEqual({
        available: false,
        reason: "PROVIDER_ERROR",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE when OpenAI returns text that isn't valid JSON", async () => {
      registerOpenAiChatHandler("this is not json at all {{{");
      const service = buildService();
      const result = await service.analyze(validAnalyzeBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE when OpenAI returns valid JSON that fails schema validation", async () => {
      registerOpenAiChatHandler(JSON.stringify({ temuan: [], rekomendasi: [], ringkasan: "" }));
      const service = buildService();
      const result = await service.analyze(validAnalyzeBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("does not cache an INVALID_RESPONSE result", async () => {
      const cache = new ResponseCache<unknown>();
      registerOpenAiChatHandler("not json");
      const service = buildService({ cache });
      await service.analyze(validAnalyzeBody);
      expect(cache.get("analyze", validAnalyzeBody)).toBeUndefined();
    });
  });

  describe("creativeBrief", () => {
    it("returns NO_API_KEY when OPENAI_API_KEY is empty", async () => {
      const service = buildService({ apiKey: "" });
      const result = await service.creativeBrief(validCreativeBriefBody);
      expect(result).toEqual({
        available: false,
        reason: "NO_API_KEY",
        message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
      });
    });

    it("returns a validated available:true payload on a well-formed OpenAI response, and caches it", async () => {
      registerOpenAiChatHandler(validCreativeBriefLlmJson);
      const cache = new ResponseCache<unknown>();
      const service = buildService({ cache });
      const first = await service.creativeBrief(validCreativeBriefBody);
      expect(first).toEqual({ available: true, ...JSON.parse(validCreativeBriefLlmJson) });

      mswServer.resetHandlers();
      const second = await service.creativeBrief(validCreativeBriefBody);
      expect(second).toEqual(first);
    });

    it("returns INVALID_RESPONSE (fails closed) when OpenAI hallucinates an angle outside the real AdAngle enum", async () => {
      registerOpenAiChatHandler(
        JSON.stringify({
          unit: "Xpander",
          angle: "MADE_UP_ANGLE",
          branch: "BINTARO",
          primaryMessage: "msg",
          tone: "casual",
          formats: ["VIDEO_15S"],
          avoid: [],
          urgency: "LOW",
        }),
      );
      const service = buildService();
      const result = await service.creativeBrief(validCreativeBriefBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE when OpenAI returns text that isn't valid JSON", async () => {
      registerOpenAiChatHandler("not json at all {{{");
      const service = buildService();
      const result = await service.creativeBrief(validCreativeBriefBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns PROVIDER_ERROR when the OpenAI call fails", async () => {
      registerOpenAiErrorHandler(503);
      const service = buildService();
      const result = await service.creativeBrief(validCreativeBriefBody);
      expect(result).toEqual({
        available: false,
        reason: "PROVIDER_ERROR",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns RATE_LIMITED when the local budget is exhausted", async () => {
      const service = buildService({ rateLimiter: new AlwaysRateLimitedLimiter() });
      const result = await service.creativeBrief(validCreativeBriefBody);
      expect(result).toEqual({
        available: false,
        reason: "RATE_LIMITED",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });
  });

  describe("chat", () => {
    it("returns NO_API_KEY when OPENAI_API_KEY is empty", async () => {
      const service = buildService({ apiKey: "" });
      const result = await service.chat({ messages: [{ role: "user", content: "Halo" }] });
      expect(result).toEqual({
        available: false,
        reason: "NO_API_KEY",
        message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
      });
    });

    it("returns available:true with the OpenAI reply on success, and caches it", async () => {
      registerOpenAiChatHandler("Performa iklan minggu ini stabil.");
      const cache = new ResponseCache<unknown>();
      const service = buildService({ cache });
      const body = { messages: [{ role: "user" as const, content: "Bagaimana performa?" }] };
      const first = await service.chat(body);
      expect(first).toEqual({ available: true, reply: "Performa iklan minggu ini stabil." });

      mswServer.resetHandlers();
      const second = await service.chat(body);
      expect(second).toEqual(first);
    });

    it("prepends the context into the system prompt when provided", async () => {
      let receivedBody: unknown;
      mswServer.use(
        http.post(`${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`, async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json({ choices: [{ message: { content: "ok" } }] });
        }),
      );
      const service = buildService();
      await service.chat({
        messages: [{ role: "user", content: "Halo" }],
        context: "dashboard: Simulasi",
      });
      const messages = (receivedBody as { messages: Array<{ role: string; content: string }> })
        .messages;
      expect(messages[0]?.content).toContain("dashboard: Simulasi");
    });

    it("returns PROVIDER_ERROR when the OpenAI call fails", async () => {
      registerOpenAiErrorHandler(429);
      const service = buildService();
      const result = await service.chat({ messages: [{ role: "user", content: "Halo" }] });
      expect(result).toEqual({
        available: false,
        reason: "PROVIDER_ERROR",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns RATE_LIMITED when the local budget is exhausted", async () => {
      const service = buildService({ rateLimiter: new AlwaysRateLimitedLimiter() });
      const result = await service.chat({ messages: [{ role: "user", content: "Halo" }] });
      expect(result).toEqual({
        available: false,
        reason: "RATE_LIMITED",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });
  });

  describe("cache isolation across endpoints", () => {
    it("does not serve a creativeBrief cache entry for an analyze call given the exact same body", async () => {
      const sharedBody = { campaigns: [] };
      const cache = new ResponseCache<unknown>();
      cache.set("creative-brief", sharedBody, { available: true, fake: "creative-brief-cached" });
      registerOpenAiChatHandler(validAnalyzeLlmJson);
      const service = buildService({ cache });
      const result = await service.analyze(sharedBody);
      expect(result).not.toEqual({ available: true, fake: "creative-brief-cached" });
      expect(result).toEqual({ available: true, ...JSON.parse(validAnalyzeLlmJson) });
    });
  });

  it("reuses the real TokenBucketRateLimiter without throwing when constructed with the LLM capacity/window", () => {
    const limiter = new TokenBucketRateLimiter({ capacity: 10, refillWindowMs: 60_000 });
    expect(limiter.tryConsume().ok).toBe(true);
  });
});
