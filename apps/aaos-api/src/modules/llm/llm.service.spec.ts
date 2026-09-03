import { err, ok, type Result } from "@aos/common";
import {
  RateLimitError,
  TokenBucketRateLimiter,
  type IRateLimiter,
  type RateLimitStatus,
} from "@aos/meta-ads-connector";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../test-support/fixtures.js";
import {
  mswServer,
  registerOpenAiChatHandler,
  registerOpenAiErrorHandler,
} from "../../test-support/openai-msw.js";
import { PromptOverrideRepository } from "../prompt-override/infrastructure/prompt-override.repository.js";
import { PromptOverrideService } from "../prompt-override/prompt-override.service.js";

import { ResponseCache } from "./cache/ResponseCache.js";
import type { AnalyzeRequestDto } from "./dto/analyze.dto.js";
import type { AssetInsightRequestDto } from "./dto/asset-insight.dto.js";
import type { CampaignStrategyRequestDto } from "./dto/campaign-strategy.dto.js";
import type { CreativeBriefRequestDto } from "./dto/creative-brief.dto.js";
import type { DailyInsightRequestDto } from "./dto/daily-insight.dto.js";
import type { GenerateCaptionRequestDto } from "./dto/generate-caption.dto.js";
import type { GenerateHashtagsRequestDto } from "./dto/generate-hashtags.dto.js";
import type { ImprovementPlanRequestDto } from "./dto/improvement-plan.dto.js";
import type { SelectTargetingRequestDto } from "./dto/select-targeting.dto.js";
import {
  CHAT_COMPLETIONS_PATH,
  OPENAI_BASE_URL,
  OpenAiClient,
} from "./infrastructure/OpenAiClient.js";
import { ANALYZE_SYSTEM_PROMPT, LlmService } from "./llm.service.js";

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
    readonly promptOverride?: PromptOverrideService;
  } = {},
): LlmService {
  const config = buildTestConfig({ OPENAI_API_KEY: overrides.apiKey ?? "test-openai-key" });
  const client = new OpenAiClient({ apiKey: config.OPENAI_API_KEY });
  const rateLimiter = overrides.rateLimiter ?? new AlwaysAllowedLimiter();
  const cache = overrides.cache ?? new ResponseCache<unknown>();
  // Real `PromptOverrideService` over a fake, unseeded Supabase client — every call falls through
  // to the real hardcoded prompt constant unchanged, exercising the exact same real resolution path
  // production uses without a real network call. `PromptOverrideService.resolve` itself is
  // exercised on its own in `prompt-override.service.spec.ts`.
  const promptOverride =
    overrides.promptOverride ??
    new PromptOverrideService(new PromptOverrideRepository(createFakeSupabaseClient()));
  return new LlmService(config, client, rateLimiter, cache, promptOverride);
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

/** Real tenant id every test in this file threads through — no behavioral significance beyond being a non-empty string, since no `agent_prompt_overrides` row exists in these unit tests (`PromptOverrideService` is exercised on its own in `prompt-override.service.spec.ts`). */
const TENANT_ID = "dss-motor";

describe("LlmService", () => {
  describe("analyze", () => {
    it("returns NO_API_KEY when OPENAI_API_KEY is empty, without consuming rate-limit budget", async () => {
      const rateLimiter = new AlwaysAllowedLimiter();
      const consumeSpy = vi.spyOn(rateLimiter, "tryConsume");
      const service = buildService({ apiKey: "", rateLimiter });
      const result = await service.analyze(TENANT_ID, validAnalyzeBody);
      expect(result).toEqual({
        available: false,
        reason: "NO_API_KEY",
        message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
      });
      expect(consumeSpy).not.toHaveBeenCalled();
    });

    it("returns RATE_LIMITED when the local budget is exhausted", async () => {
      const service = buildService({ rateLimiter: new AlwaysRateLimitedLimiter() });
      const result = await service.analyze(TENANT_ID, validAnalyzeBody);
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

      const first = await service.analyze(TENANT_ID, validAnalyzeBody);
      expect(first).toEqual({ available: true, ...JSON.parse(validAnalyzeLlmJson) });

      // Second identical call must be served from cache — deregister every handler so a real
      // second network call would fail under onUnhandledRequest: "error" if the cache didn't work.
      mswServer.resetHandlers();
      const second = await service.analyze(TENANT_ID, validAnalyzeBody);
      expect(second).toEqual(first);
    });

    it("returns PROVIDER_ERROR when the OpenAI call fails (non-2xx)", async () => {
      registerOpenAiErrorHandler(500);
      const service = buildService();
      const result = await service.analyze(TENANT_ID, validAnalyzeBody);
      expect(result).toEqual({
        available: false,
        reason: "PROVIDER_ERROR",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE when OpenAI returns text that isn't valid JSON", async () => {
      registerOpenAiChatHandler("this is not json at all {{{");
      const service = buildService();
      const result = await service.analyze(TENANT_ID, validAnalyzeBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE when OpenAI returns valid JSON that fails schema validation", async () => {
      registerOpenAiChatHandler(JSON.stringify({ temuan: [], rekomendasi: [], ringkasan: "" }));
      const service = buildService();
      const result = await service.analyze(TENANT_ID, validAnalyzeBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("uses a tenant's active agent_prompt_overrides row as the system prompt instead of the hardcoded default (AAOS Self-Learning AI Phase A)", async () => {
      const client = createFakeSupabaseClient();
      client.seed("agent_prompt_overrides", {
        id: "row-1",
        tenant_id: TENANT_ID,
        agent: "SAMANTHA",
        prompt_key: "analyze",
        content: "OVERRIDDEN ANALYZE PROMPT — from a real active agent_prompt_overrides row.",
        version: 2,
        is_active: true,
        created_at: "2026-01-01T00:00:00.000Z",
        activated_at: "2026-01-01T00:00:00.000Z",
        deactivated_at: null,
      });
      const promptOverride = new PromptOverrideService(new PromptOverrideRepository(client));

      let receivedBody: unknown;
      mswServer.use(
        http.post(`${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`, async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json({ choices: [{ message: { content: validAnalyzeLlmJson } }] });
        }),
      );

      const service = buildService({ promptOverride });
      await service.analyze(TENANT_ID, validAnalyzeBody);

      const messages = (receivedBody as { messages: Array<{ role: string; content: string }> })
        .messages;
      expect(messages[0]?.content).toBe(
        "OVERRIDDEN ANALYZE PROMPT — from a real active agent_prompt_overrides row.",
      );
    });

    it("does not cache an INVALID_RESPONSE result", async () => {
      const cache = new ResponseCache<unknown>();
      registerOpenAiChatHandler("not json");
      const service = buildService({ cache });
      await service.analyze(TENANT_ID, validAnalyzeBody);
      expect(cache.get("analyze", validAnalyzeBody)).toBeUndefined();
    });
  });

  describe("creativeBrief", () => {
    it("returns NO_API_KEY when OPENAI_API_KEY is empty", async () => {
      const service = buildService({ apiKey: "" });
      const result = await service.creativeBrief(TENANT_ID, validCreativeBriefBody);
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
      const first = await service.creativeBrief(TENANT_ID, validCreativeBriefBody);
      expect(first).toEqual({ available: true, ...JSON.parse(validCreativeBriefLlmJson) });

      mswServer.resetHandlers();
      const second = await service.creativeBrief(TENANT_ID, validCreativeBriefBody);
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
      const result = await service.creativeBrief(TENANT_ID, validCreativeBriefBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE when OpenAI returns text that isn't valid JSON", async () => {
      registerOpenAiChatHandler("not json at all {{{");
      const service = buildService();
      const result = await service.creativeBrief(TENANT_ID, validCreativeBriefBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns PROVIDER_ERROR when the OpenAI call fails", async () => {
      registerOpenAiErrorHandler(503);
      const service = buildService();
      const result = await service.creativeBrief(TENANT_ID, validCreativeBriefBody);
      expect(result).toEqual({
        available: false,
        reason: "PROVIDER_ERROR",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns RATE_LIMITED when the local budget is exhausted", async () => {
      const service = buildService({ rateLimiter: new AlwaysRateLimitedLimiter() });
      const result = await service.creativeBrief(TENANT_ID, validCreativeBriefBody);
      expect(result).toEqual({
        available: false,
        reason: "RATE_LIMITED",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });
  });

  describe("assetInsight", () => {
    const validAssetInsightBody: AssetInsightRequestDto = {
      assetKind: "IMAGE",
      assetId: "hash-A",
      adCount: 2,
      spend: 300_000,
      totalLead: 3,
      cpl: 100_000,
      maxFrequency: 2.1,
      audienceBreakdown: [
        { audienceLabel: "BROAD", adCount: 1, spend: 100_000, totalLead: 2, cpl: 50_000 },
        { audienceLabel: "INTEREST", adCount: 1, spend: 200_000, totalLead: 1, cpl: 200_000 },
      ],
      benchmarkCplIDR: 80_000,
    };
    const validAssetInsightLlmJson = JSON.stringify({
      summary: "Audiens BROAD paling efisien untuk aset ini dengan CPL terendah.",
    });

    it("returns NO_API_KEY when OPENAI_API_KEY is empty", async () => {
      const service = buildService({ apiKey: "" });
      const result = await service.assetInsight(TENANT_ID, validAssetInsightBody);
      expect(result).toEqual({
        available: false,
        reason: "NO_API_KEY",
        message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
      });
    });

    it("returns a validated available:true payload on a well-formed OpenAI response, and caches it", async () => {
      registerOpenAiChatHandler(validAssetInsightLlmJson);
      const cache = new ResponseCache<unknown>();
      const service = buildService({ cache });
      const first = await service.assetInsight(TENANT_ID, validAssetInsightBody);
      expect(first).toEqual({ available: true, ...JSON.parse(validAssetInsightLlmJson) });

      mswServer.resetHandlers();
      const second = await service.assetInsight(TENANT_ID, validAssetInsightBody);
      expect(second).toEqual(first);
    });

    it("returns INVALID_RESPONSE when OpenAI returns text that isn't valid JSON", async () => {
      registerOpenAiChatHandler("not json at all {{{");
      const service = buildService();
      const result = await service.assetInsight(TENANT_ID, validAssetInsightBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns PROVIDER_ERROR when the OpenAI call fails", async () => {
      registerOpenAiErrorHandler(503);
      const service = buildService();
      const result = await service.assetInsight(TENANT_ID, validAssetInsightBody);
      expect(result).toEqual({
        available: false,
        reason: "PROVIDER_ERROR",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns RATE_LIMITED when the local budget is exhausted", async () => {
      const service = buildService({ rateLimiter: new AlwaysRateLimitedLimiter() });
      const result = await service.assetInsight(TENANT_ID, validAssetInsightBody);
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
      const result = await service.chat(TENANT_ID, {
        messages: [{ role: "user", content: "Halo" }],
      });
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
      const first = await service.chat(TENANT_ID, body);
      expect(first).toEqual({ available: true, reply: "Performa iklan minggu ini stabil." });

      mswServer.resetHandlers();
      const second = await service.chat(TENANT_ID, body);
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
      await service.chat(TENANT_ID, {
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
      const result = await service.chat(TENANT_ID, {
        messages: [{ role: "user", content: "Halo" }],
      });
      expect(result).toEqual({
        available: false,
        reason: "PROVIDER_ERROR",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns RATE_LIMITED when the local budget is exhausted", async () => {
      const service = buildService({ rateLimiter: new AlwaysRateLimitedLimiter() });
      const result = await service.chat(TENANT_ID, {
        messages: [{ role: "user", content: "Halo" }],
      });
      expect(result).toEqual({
        available: false,
        reason: "RATE_LIMITED",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });
  });

  describe("selectTargeting (AAOS-SIMULASI-TARGETING)", () => {
    /** Real candidates, verbatim from live Meta `GET /search?type=adinterest` responses (2026-08-18). */
    const validSelectTargetingBody: SelectTargetingRequestDto = {
      unit: "Xpander Ultimate",
      angle: "DP_RINGAN",
      branch: "BINTARO" as SelectTargetingRequestDto["branch"],
      candidates: [
        {
          id: "6003257869482",
          name: "Used car (vehicle)",
          audienceSizeLower: 61362891,
          audienceSizeUpper: 72162760,
          topic: "Business and industry",
        },
        {
          id: "6003739713691",
          name: "car finance (credit and lending)",
          audienceSizeLower: 8039557,
          audienceSizeUpper: 9454520,
          topic: "Business and industry",
        },
      ],
    };

    it("returns NO_API_KEY when OPENAI_API_KEY is empty", async () => {
      const service = buildService({ apiKey: "" });
      const result = await service.selectTargeting(TENANT_ID, validSelectTargetingBody);
      expect(result).toEqual({
        available: false,
        reason: "NO_API_KEY",
        message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
      });
    });

    it("returns RATE_LIMITED when the local budget is exhausted", async () => {
      const service = buildService({ rateLimiter: new AlwaysRateLimitedLimiter() });
      const result = await service.selectTargeting(TENANT_ID, validSelectTargetingBody);
      expect(result).toEqual({
        available: false,
        reason: "RATE_LIMITED",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns the selected real interest ids on a well-formed response, and caches it", async () => {
      registerOpenAiChatHandler(
        JSON.stringify({
          interestIds: ["6003257869482", "6003739713691"],
          reasoning: "Keduanya relevan untuk pembeli mobil bekas dengan skema kredit.",
        }),
      );
      const cache = new ResponseCache<unknown>();
      const service = buildService({ cache });

      const first = await service.selectTargeting(TENANT_ID, validSelectTargetingBody);
      expect(first).toEqual({
        available: true,
        interestIds: ["6003257869482", "6003739713691"],
        reasoning: "Keduanya relevan untuk pembeli mobil bekas dengan skema kredit.",
        rejectedIds: [],
      });

      mswServer.resetHandlers();
      const second = await service.selectTargeting(TENANT_ID, validSelectTargetingBody);
      expect(second).toEqual(first);
    });

    it("DROPS an id the model invented that was not in the candidate set it was shown", async () => {
      registerOpenAiChatHandler(
        JSON.stringify({
          // The second id is a plausible-looking Meta interest id that was NEVER in `candidates`.
          interestIds: ["6003257869482", "6003107902433"],
          reasoning: "alasan",
        }),
      );
      const service = buildService();
      const result = await service.selectTargeting(TENANT_ID, validSelectTargetingBody);
      expect(result).toEqual({
        available: true,
        interestIds: ["6003257869482"],
        reasoning: "alasan",
        rejectedIds: ["6003107902433"],
      });
    });

    it("fails closed with INVALID_RESPONSE when EVERY returned id was invented", async () => {
      registerOpenAiChatHandler(
        JSON.stringify({ interestIds: ["1111111111111"], reasoning: "alasan" }),
      );
      const service = buildService();
      const result = await service.selectTargeting(TENANT_ID, validSelectTargetingBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE for an empty selection or a missing reasoning field", async () => {
      registerOpenAiChatHandler(JSON.stringify({ interestIds: [], reasoning: "alasan" }));
      const service = buildService();
      expect((await service.selectTargeting(TENANT_ID, validSelectTargetingBody)).available).toBe(
        false,
      );

      registerOpenAiChatHandler(JSON.stringify({ interestIds: ["6003257869482"] }));
      expect(
        (await buildService().selectTargeting(TENANT_ID, validSelectTargetingBody)).available,
      ).toBe(false);
    });

    it("returns INVALID_RESPONSE when OpenAI returns text that isn't valid JSON", async () => {
      registerOpenAiChatHandler("not json {{{");
      const service = buildService();
      expect((await service.selectTargeting(TENANT_ID, validSelectTargetingBody)).available).toBe(
        false,
      );
    });

    it("returns PROVIDER_ERROR when the OpenAI call fails", async () => {
      registerOpenAiErrorHandler(500);
      const service = buildService();
      const result = await service.selectTargeting(TENANT_ID, validSelectTargetingBody);
      expect(result).toEqual({
        available: false,
        reason: "PROVIDER_ERROR",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("sends the real candidate list to the model and states the candidate-only rule in the prompt", async () => {
      let receivedBody: unknown;
      mswServer.use(
        http.post(`${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`, async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    interestIds: ["6003257869482"],
                    reasoning: "ok",
                  }),
                },
              },
            ],
          });
        }),
      );
      await buildService().selectTargeting(TENANT_ID, validSelectTargetingBody);
      const messages = (receivedBody as { messages: Array<{ role: string; content: string }> })
        .messages;
      expect(messages[0]?.content).toContain("HANYA boleh memilih");
      expect(messages[1]?.content).toContain("6003739713691");
    });

    it("does not cache a rejected (INVALID_RESPONSE) selection", async () => {
      const cache = new ResponseCache<unknown>();
      registerOpenAiChatHandler(
        JSON.stringify({ interestIds: ["1111111111111"], reasoning: "alasan" }),
      );
      const service = buildService({ cache });
      await service.selectTargeting(TENANT_ID, validSelectTargetingBody);
      expect(cache.get("select-targeting", validSelectTargetingBody)).toBeUndefined();
    });
  });

  describe("generateCaption (AAOS-SOSMED-AUTOMATION Phase 1)", () => {
    const validCaptionBody: GenerateCaptionRequestDto = {
      contentType: "PROMO",
      productRef: "Xpander Cross 2019 - Cinere, DP mulai 29 juta",
      angle: "DP Ringan",
      tone: "FRIENDLY",
      vertical: "AUTOMOTIVE",
    };
    const validCaptionLlmJson = JSON.stringify({
      instagramCaption: "Xpander Cross 2019 siap bawa keluarga! DP mulai 29 juta. Chat sekarang!",
      facebookCaption: "Halo sahabat Mobix! Kabar gembira untuk yang lagi cari mobil keluarga...",
    });

    it("returns NO_API_KEY when OPENAI_API_KEY is empty", async () => {
      const service = buildService({ apiKey: "" });
      const result = await service.generateCaption(TENANT_ID, validCaptionBody);
      expect(result).toEqual({
        available: false,
        reason: "NO_API_KEY",
        message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
      });
    });

    it("returns RATE_LIMITED when the local budget is exhausted", async () => {
      const service = buildService({ rateLimiter: new AlwaysRateLimitedLimiter() });
      const result = await service.generateCaption(TENANT_ID, validCaptionBody);
      expect(result).toEqual({
        available: false,
        reason: "RATE_LIMITED",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns a validated available:true payload on a well-formed OpenAI response, and caches it", async () => {
      registerOpenAiChatHandler(validCaptionLlmJson);
      const cache = new ResponseCache<unknown>();
      const service = buildService({ cache });

      const first = await service.generateCaption(TENANT_ID, validCaptionBody);
      expect(first).toEqual({ available: true, ...JSON.parse(validCaptionLlmJson) });

      mswServer.resetHandlers();
      const second = await service.generateCaption(TENANT_ID, validCaptionBody);
      expect(second).toEqual(first);
    });

    it("returns PROVIDER_ERROR when the OpenAI call fails", async () => {
      registerOpenAiErrorHandler(500);
      const service = buildService();
      const result = await service.generateCaption(TENANT_ID, validCaptionBody);
      expect(result).toEqual({
        available: false,
        reason: "PROVIDER_ERROR",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE when OpenAI returns text that isn't valid JSON", async () => {
      registerOpenAiChatHandler("not json at all {{{");
      const service = buildService();
      const result = await service.generateCaption(TENANT_ID, validCaptionBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE when OpenAI returns valid JSON missing facebookCaption", async () => {
      registerOpenAiChatHandler(JSON.stringify({ instagramCaption: "only IG" }));
      const service = buildService();
      const result = await service.generateCaption(TENANT_ID, validCaptionBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("sends the brief as JSON in the user message, with a static persona system prompt", async () => {
      let receivedBody: unknown;
      mswServer.use(
        http.post(`${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`, async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json({
            choices: [{ message: { content: validCaptionLlmJson } }],
          });
        }),
      );
      await buildService().generateCaption(TENANT_ID, validCaptionBody);
      const messages = (receivedBody as { messages: Array<{ role: string; content: string }> })
        .messages;
      expect(messages[0]?.content).toContain("Samantha");
      expect(messages[1]?.content).toContain("Xpander Cross 2019 - Cinere");
    });
  });

  describe("generateHashtags (AAOS-SOSMED-AUTOMATION Phase 1)", () => {
    const validHashtagsBody: GenerateHashtagsRequestDto = {
      productName: "Xpander Cross 2019",
      brand: "MobixCinere",
      location: "Cinere",
      vertical: "AUTOMOTIVE",
    };
    const validHashtagsLlmJson = JSON.stringify({
      hashtags: [
        "#MobixCinere",
        "#XpanderCross",
        "#MobilBekas",
        "#DPRingan",
        "#KreditMobil",
        "#Cinere",
        "#Depok",
        "#MobilBekasDepok",
      ],
    });

    it("returns NO_API_KEY when OPENAI_API_KEY is empty", async () => {
      const service = buildService({ apiKey: "" });
      const result = await service.generateHashtags(TENANT_ID, validHashtagsBody);
      expect(result).toEqual({
        available: false,
        reason: "NO_API_KEY",
        message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
      });
    });

    it("returns RATE_LIMITED when the local budget is exhausted", async () => {
      const service = buildService({ rateLimiter: new AlwaysRateLimitedLimiter() });
      const result = await service.generateHashtags(TENANT_ID, validHashtagsBody);
      expect(result).toEqual({
        available: false,
        reason: "RATE_LIMITED",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns a validated available:true payload on a well-formed OpenAI response (8-12 hashtags), and caches it", async () => {
      registerOpenAiChatHandler(validHashtagsLlmJson);
      const cache = new ResponseCache<unknown>();
      const service = buildService({ cache });

      const first = await service.generateHashtags(TENANT_ID, validHashtagsBody);
      expect(first).toEqual({ available: true, ...JSON.parse(validHashtagsLlmJson) });

      mswServer.resetHandlers();
      const second = await service.generateHashtags(TENANT_ID, validHashtagsBody);
      expect(second).toEqual(first);
    });

    it("returns PROVIDER_ERROR when the OpenAI call fails", async () => {
      registerOpenAiErrorHandler(503);
      const service = buildService();
      const result = await service.generateHashtags(TENANT_ID, validHashtagsBody);
      expect(result).toEqual({
        available: false,
        reason: "PROVIDER_ERROR",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE (fails closed) when OpenAI returns fewer than 8 hashtags", async () => {
      registerOpenAiChatHandler(JSON.stringify({ hashtags: ["#OnlyOne", "#OnlyTwo"] }));
      const service = buildService();
      const result = await service.generateHashtags(TENANT_ID, validHashtagsBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE (fails closed) when a hashtag is missing the # prefix", async () => {
      registerOpenAiChatHandler(
        JSON.stringify({
          hashtags: ["MissingHash", "#B", "#C", "#D", "#E", "#F", "#G", "#H"],
        }),
      );
      const service = buildService();
      const result = await service.generateHashtags(TENANT_ID, validHashtagsBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE when OpenAI returns text that isn't valid JSON", async () => {
      registerOpenAiChatHandler("not json {{{");
      const service = buildService();
      const result = await service.generateHashtags(TENANT_ID, validHashtagsBody);
      expect(result.available).toBe(false);
    });

    it("sends the brief as JSON in the user message, with a static persona system prompt", async () => {
      let receivedBody: unknown;
      mswServer.use(
        http.post(`${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`, async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json({
            choices: [{ message: { content: validHashtagsLlmJson } }],
          });
        }),
      );
      await buildService().generateHashtags(TENANT_ID, validHashtagsBody);
      const messages = (receivedBody as { messages: Array<{ role: string; content: string }> })
        .messages;
      expect(messages[0]?.content).toContain("Samantha");
      expect(messages[1]?.content).toContain("MobixCinere");
    });
  });

  describe("campaignStrategy (AAOS-SAMANTHA-INTELLIGENCE-LAYER Phase 4)", () => {
    const validCampaignStrategyBody: CampaignStrategyRequestDto = {
      vertical: "AUTOMOTIVE",
      tenantName: "DSS Motor",
      branchId: "BINTARO",
      brandAngleIds: ["BRAND_TRUST", "JUAL_BELI", "TUKAR_TAMBAH", "BENGKEL_GRATIS", "KOMUNITAS"],
      productAngleValues: [
        "DP_RINGAN",
        "KREDIT_SYARIAH",
        "GUDANGNYA",
        "QNA",
        "DISCOVERY",
        "TESTIMONIAL",
        "WEBSITE_REDIRECT",
      ],
      seasonal: { isSpecialPeriod: false, reasoning: "Periode normal" },
      trends: { available: false, reasoning: "Google Trends tidak tersedia" },
      competitor: { available: false, reasoning: "Data kompetitor tidak tersedia" },
      inventory: { available: true, hasLowStock: false, reasoning: "Stok normal" },
      leadProfile: {
        totalLeads: 10,
        avgScore: 70,
        topBranches: [{ branchId: "BINTARO", count: 10 }],
      },
      closing: { totalEvents: 5, topUnitModels: [], slowUnitModels: [] },
    };

    const validCampaignStrategyLlmJson = JSON.stringify({
      campaignMode: "BOTH",
      reasoning: "Stok normal, brand awareness tetap penting",
      brandCampaign: {
        angle: "BRAND_TRUST",
        copy: "Mobix dealer mobil bekas terpercaya",
        objective: "OUTCOME_AWARENESS",
        budgetPct: 30,
        reasoning: "Bangun awareness",
      },
      productCampaign: {
        angle: "DP_RINGAN",
        targetUnit: "Xpander",
        copy: "DP ringan mulai 10 juta",
        objective: "OUTCOME_LEADS",
        budgetPct: 70,
        reasoning: "Angle evergreen performa terbaik",
      },
      budgetRecommendation: { action: "MAINTAIN", multiplier: 1.0, reasoning: "Performa stabil" },
      targeting: {
        locations: ["Bintaro"],
        ageMin: 22,
        ageMax: 55,
        interests: ["family cars"],
        reasoning: "Berdasarkan profil hot lead",
      },
      timing: { bestHours: [10, 19], reasoning: "Peak engagement" },
      urgency: "MEDIUM",
      summary: "Brand 30% TRUST + Product 70% DP_RINGAN Xpander",
    });

    it("returns NO_API_KEY when OPENAI_API_KEY is empty", async () => {
      const service = buildService({ apiKey: "" });
      const result = await service.campaignStrategy(TENANT_ID, validCampaignStrategyBody);
      expect(result).toEqual({
        available: false,
        reason: "NO_API_KEY",
        message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
      });
    });

    it("returns a validated available:true payload on a well-formed OpenAI response, and caches it", async () => {
      registerOpenAiChatHandler(validCampaignStrategyLlmJson);
      const cache = new ResponseCache<unknown>();
      const service = buildService({ cache });
      const first = await service.campaignStrategy(TENANT_ID, validCampaignStrategyBody);
      expect(first).toEqual({ available: true, ...JSON.parse(validCampaignStrategyLlmJson) });

      mswServer.resetHandlers();
      const second = await service.campaignStrategy(TENANT_ID, validCampaignStrategyBody);
      expect(second).toEqual(first);
    });

    it("returns INVALID_RESPONSE (fails closed) when brandCampaign.angle is outside the real brandAngleIds sent in the request", async () => {
      registerOpenAiChatHandler(
        JSON.stringify({
          ...JSON.parse(validCampaignStrategyLlmJson),
          brandCampaign: {
            ...JSON.parse(validCampaignStrategyLlmJson).brandCampaign,
            angle: "MADE_UP_BRAND_ANGLE",
          },
        }),
      );
      const service = buildService();
      const result = await service.campaignStrategy(TENANT_ID, validCampaignStrategyBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE (fails closed) when productCampaign.angle is outside the real productAngleValues sent in the request", async () => {
      registerOpenAiChatHandler(
        JSON.stringify({
          ...JSON.parse(validCampaignStrategyLlmJson),
          productCampaign: {
            ...JSON.parse(validCampaignStrategyLlmJson).productCampaign,
            angle: "MADE_UP_PRODUCT_ANGLE",
          },
        }),
      );
      const service = buildService();
      const result = await service.campaignStrategy(TENANT_ID, validCampaignStrategyBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE when campaignMode is BOTH but brandCampaign is missing", async () => {
      const payload = JSON.parse(validCampaignStrategyLlmJson) as Record<string, unknown>;
      delete payload.brandCampaign;
      registerOpenAiChatHandler(JSON.stringify(payload));
      const service = buildService();
      const result = await service.campaignStrategy(TENANT_ID, validCampaignStrategyBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE when OpenAI returns text that isn't valid JSON", async () => {
      registerOpenAiChatHandler("not json at all {{{");
      const service = buildService();
      const result = await service.campaignStrategy(TENANT_ID, validCampaignStrategyBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns PROVIDER_ERROR when the OpenAI call fails", async () => {
      registerOpenAiErrorHandler(503);
      const service = buildService();
      const result = await service.campaignStrategy(TENANT_ID, validCampaignStrategyBody);
      expect(result).toEqual({
        available: false,
        reason: "PROVIDER_ERROR",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns RATE_LIMITED when the local budget is exhausted", async () => {
      const service = buildService({ rateLimiter: new AlwaysRateLimitedLimiter() });
      const result = await service.campaignStrategy(TENANT_ID, validCampaignStrategyBody);
      expect(result).toEqual({
        available: false,
        reason: "RATE_LIMITED",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });
  });

  describe("generateImprovementPlan", () => {
    const validGapBody: ImprovementPlanRequestDto = {
      tenantId: TENANT_ID,
      agent: "SAMANTHA",
      gap: {
        samanthaCoverageScore: 40,
        kaiScore: 100,
        claraScore: 60,
        overallScore: 55,
        grade: "D",
        verdict: "NO-GO",
        feedbackItems: [{ dimension: "clarity", message: "Balasan Clara kurang jelas soal DP." }],
      },
      currentPromptKey: "analyze",
      currentPromptContent: ANALYZE_SYSTEM_PROMPT,
      recentProposals: [],
    };
    const validImprovementPlanLlmJson = JSON.stringify({
      analysis: "Skor Samantha rendah karena ringkasan kosong pada beberapa respons.",
      improvements: [
        {
          agent: "SAMANTHA",
          type: "PROMPT_UPDATE",
          target: "analyze",
          before: "Format response JSON: { ... }",
          after: "Format response JSON dengan ringkasan WAJIB diisi minimal satu kalimat: { ... }",
          reason: "ringkasan kosong menurunkan coverage score",
          severity: "MEDIUM",
        },
      ],
    });

    it("returns NO_API_KEY when OPENAI_API_KEY is empty", async () => {
      const service = buildService({ apiKey: "" });
      const result = await service.generateImprovementPlan(TENANT_ID, validGapBody);
      expect(result).toEqual({
        available: false,
        reason: "NO_API_KEY",
        message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
        droppedCount: 0,
      });
    });

    it("returns a validated available:true payload with every improvement's target intact when it's a real prompt_key, and caches it", async () => {
      registerOpenAiChatHandler(validImprovementPlanLlmJson);
      const cache = new ResponseCache<unknown>();
      const service = buildService({ cache });
      const first = await service.generateImprovementPlan(TENANT_ID, validGapBody);
      expect(first).toEqual({
        available: true,
        ...JSON.parse(validImprovementPlanLlmJson),
        droppedCount: 0,
      });

      mswServer.resetHandlers();
      const second = await service.generateImprovementPlan(TENANT_ID, validGapBody);
      expect(second).toEqual(first);
    });

    it("drops (never keeps) any improvement whose target isn't a real known prompt_key, and reports droppedCount", async () => {
      registerOpenAiChatHandler(
        JSON.stringify({
          analysis: "analisa nyata",
          improvements: [
            {
              agent: "SAMANTHA",
              type: "PROMPT_UPDATE",
              target: "analyze",
              before: "b",
              after: "a",
              reason: "r",
              severity: "LOW",
            },
            {
              agent: "SAMANTHA",
              type: "PROMPT_UPDATE",
              target: "made_up_prompt_key",
              before: "b",
              after: "a",
              reason: "r",
              severity: "LOW",
            },
          ],
        }),
      );
      const service = buildService();
      const result = await service.generateImprovementPlan(TENANT_ID, validGapBody);
      expect(result.available).toBe(true);
      if (result.available) {
        expect(result.improvements).toHaveLength(1);
        expect(result.improvements[0]?.target).toBe("analyze");
      }
      expect(result.droppedCount).toBe(1);
    });

    it("drops a CONFIG_UPDATE improvement (no real config_key vocabulary exists to validate against — see this method's own doc)", async () => {
      registerOpenAiChatHandler(
        JSON.stringify({
          analysis: "analisa nyata",
          improvements: [
            {
              agent: "SAMANTHA",
              type: "CONFIG_UPDATE",
              target: "copy_length_cap",
              before: "b",
              after: "a",
              reason: "r",
              severity: "LOW",
            },
          ],
        }),
      );
      const service = buildService();
      const result = await service.generateImprovementPlan(TENANT_ID, validGapBody);
      expect(result.available).toBe(true);
      if (result.available) {
        expect(result.improvements).toHaveLength(0);
      }
      expect(result.droppedCount).toBe(1);
    });

    it("returns INVALID_RESPONSE when OpenAI returns text that isn't valid JSON", async () => {
      registerOpenAiChatHandler("not json at all {{{");
      const service = buildService();
      const result = await service.generateImprovementPlan(TENANT_ID, validGapBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
        droppedCount: 0,
      });
    });

    it("returns PROVIDER_ERROR when the OpenAI call fails", async () => {
      registerOpenAiErrorHandler(503);
      const service = buildService();
      const result = await service.generateImprovementPlan(TENANT_ID, validGapBody);
      expect(result).toEqual({
        available: false,
        reason: "PROVIDER_ERROR",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
        droppedCount: 0,
      });
    });

    it("returns RATE_LIMITED when the local budget is exhausted", async () => {
      const service = buildService({ rateLimiter: new AlwaysRateLimitedLimiter() });
      const result = await service.generateImprovementPlan(TENANT_ID, validGapBody);
      expect(result).toEqual({
        available: false,
        reason: "RATE_LIMITED",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
        droppedCount: 0,
      });
    });
  });

  describe("selfAnalyze (AAOS Self-Improving, Phase SI-3)", () => {
    const validGapBody: ImprovementPlanRequestDto = {
      tenantId: TENANT_ID,
      agent: "SAMANTHA",
      gap: {
        samanthaCoverageScore: 40,
        kaiScore: 100,
        claraScore: 60,
        overallScore: 55,
        grade: "D",
        verdict: "NO-GO",
        feedbackItems: [{ dimension: "clarity", message: "Balasan Clara kurang jelas soal DP." }],
      },
      currentPromptKey: "analyze",
      currentPromptContent: ANALYZE_SYSTEM_PROMPT,
      recentProposals: [],
    };
    const validSelfAnalysisLlmJson = JSON.stringify({
      rootCauses: ["Ringkasan (ringkasan) sering kosong pada respons Samantha"],
      patterns: "Ini proposal pertama untuk tenant ini, belum ada pola dari riwayat sebelumnya.",
      confidence: 0.6,
    });

    it("returns NO_API_KEY when OPENAI_API_KEY is empty", async () => {
      const service = buildService({ apiKey: "" });
      const result = await service.selfAnalyze(TENANT_ID, validGapBody);
      expect(result).toEqual({
        available: false,
        reason: "NO_API_KEY",
        message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
      });
    });

    it("returns a validated available:true payload and caches it", async () => {
      registerOpenAiChatHandler(validSelfAnalysisLlmJson);
      const cache = new ResponseCache<unknown>();
      const service = buildService({ cache });
      const first = await service.selfAnalyze(TENANT_ID, validGapBody);
      expect(first).toEqual({ available: true, ...JSON.parse(validSelfAnalysisLlmJson) });

      mswServer.resetHandlers();
      const second = await service.selfAnalyze(TENANT_ID, validGapBody);
      expect(second).toEqual(first);
    });

    it("returns INVALID_RESPONSE when OpenAI returns text that isn't valid JSON", async () => {
      registerOpenAiChatHandler("not json at all {{{");
      const service = buildService();
      const result = await service.selfAnalyze(TENANT_ID, validGapBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE when the JSON is well-formed but doesn't match the schema (e.g. confidence out of 0-1 range)", async () => {
      registerOpenAiChatHandler(
        JSON.stringify({
          rootCauses: ["akar masalah"],
          patterns: "pola",
          confidence: 15,
        }),
      );
      const service = buildService();
      const result = await service.selfAnalyze(TENANT_ID, validGapBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns PROVIDER_ERROR when the OpenAI call fails", async () => {
      registerOpenAiErrorHandler(503);
      const service = buildService();
      const result = await service.selfAnalyze(TENANT_ID, validGapBody);
      expect(result).toEqual({
        available: false,
        reason: "PROVIDER_ERROR",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns RATE_LIMITED when the local budget is exhausted", async () => {
      const service = buildService({ rateLimiter: new AlwaysRateLimitedLimiter() });
      const result = await service.selfAnalyze(TENANT_ID, validGapBody);
      expect(result).toEqual({
        available: false,
        reason: "RATE_LIMITED",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("is a genuinely SEPARATE cache/call from generateImprovementPlan for the exact same gap body", async () => {
      registerOpenAiChatHandler(validSelfAnalysisLlmJson);
      const cache = new ResponseCache<unknown>();
      const service = buildService({ cache });
      const selfAnalysisResult = await service.selfAnalyze(TENANT_ID, validGapBody);
      expect(selfAnalysisResult.available).toBe(true);

      // No handler registered now — if generateImprovementPlan wrongly served the selfAnalyze cache
      // entry, this would return the self-analysis shape (no `analysis`/`improvements`) instead of
      // failing on the network. Register a distinct, valid improvement-plan response instead.
      registerOpenAiChatHandler(
        JSON.stringify({
          analysis: "analisa nyata",
          improvements: [],
        }),
      );
      const planResult = await service.generateImprovementPlan(TENANT_ID, validGapBody);
      expect(planResult).toEqual({
        available: true,
        analysis: "analisa nyata",
        improvements: [],
        droppedCount: 0,
      });
    });
  });

  describe("generateDailyInsight", () => {
    const validDailyInsightBody: DailyInsightRequestDto = {
      tenantId: TENANT_ID,
      date: "2026-01-15",
      agents: [
        { agent: "SAMANTHA", todayAverageOverall: 82, delta: 5, actionsToday: 3 },
        { agent: "KAI", todayAverageOverall: null, delta: null, actionsToday: 0 },
        { agent: "CLARA", todayAverageOverall: 70, delta: -2, actionsToday: 4 },
      ],
      campaigns: { activeCampaignsCount: 3, totalSpend: 1_500_000, datePreset: "last_7d" },
      leads: { hot: 5, warm: 8, cold: 12, hotToday: 2, hotYesterday: 1 },
      recycling: { sentToday: 4, respondedToday: 1, onCooldown: 6 },
    };

    const validDailyInsightLlmJson = JSON.stringify({
      summary:
        "Samantha: 3 campaign aktif, CPL stabil. Kai: belum ada run hari ini. Clara: 2 lead baru jadi HOT hari ini.",
      perAgent: {
        samantha: "3 campaign aktif, CPL stabil.",
        kai: "Belum ada run hari ini.",
        clara: "2 lead baru jadi HOT hari ini.",
      },
    });

    it("returns available:true with a real, Zod-validated summary from a mocked OpenAI response", async () => {
      registerOpenAiChatHandler(validDailyInsightLlmJson);
      const service = buildService();
      const result = await service.generateDailyInsight(TENANT_ID, validDailyInsightBody);
      expect(result).toEqual({ available: true, ...JSON.parse(validDailyInsightLlmJson) });
    });

    it("never mentions Karen — only samantha/kai/clara keys are valid on the parsed payload", async () => {
      registerOpenAiChatHandler(validDailyInsightLlmJson);
      const service = buildService();
      const result = await service.generateDailyInsight(TENANT_ID, validDailyInsightBody);
      expect(result.available).toBe(true);
      if (result.available) {
        expect(Object.keys(result.perAgent).sort()).toEqual(["clara", "kai", "samantha"]);
      }
    });

    it("returns NO_API_KEY (no fabricated summary) when OPENAI_API_KEY is empty", async () => {
      const service = buildService({ apiKey: "" });
      const result = await service.generateDailyInsight(TENANT_ID, validDailyInsightBody);
      expect(result).toEqual({
        available: false,
        reason: "NO_API_KEY",
        message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
      });
    });

    it("returns PROVIDER_ERROR (no fabricated summary) when the OpenAI call fails", async () => {
      registerOpenAiErrorHandler(503);
      const service = buildService();
      const result = await service.generateDailyInsight(TENANT_ID, validDailyInsightBody);
      expect(result).toEqual({
        available: false,
        reason: "PROVIDER_ERROR",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE (no fabricated summary) when OpenAI returns malformed JSON", async () => {
      registerOpenAiChatHandler("not json at all {{{");
      const service = buildService();
      const result = await service.generateDailyInsight(TENANT_ID, validDailyInsightBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns RATE_LIMITED when the local budget is exhausted", async () => {
      const service = buildService({ rateLimiter: new AlwaysRateLimitedLimiter() });
      const result = await service.generateDailyInsight(TENANT_ID, validDailyInsightBody);
      expect(result).toEqual({
        available: false,
        reason: "RATE_LIMITED",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("caches a successful response, never re-calling OpenAI for an identical body", async () => {
      registerOpenAiChatHandler(validDailyInsightLlmJson);
      const service = buildService();
      const first = await service.generateDailyInsight(TENANT_ID, validDailyInsightBody);
      mswServer.resetHandlers(); // no handler registered — a second real call would fail
      const second = await service.generateDailyInsight(TENANT_ID, validDailyInsightBody);
      expect(second).toEqual(first);
    });
  });

  describe("cache isolation across endpoints", () => {
    it("does not serve a creativeBrief cache entry for an analyze call given the exact same body", async () => {
      const sharedBody = { campaigns: [] };
      const cache = new ResponseCache<unknown>();
      cache.set("creative-brief", sharedBody, { available: true, fake: "creative-brief-cached" });
      registerOpenAiChatHandler(validAnalyzeLlmJson);
      const service = buildService({ cache });
      const result = await service.analyze(TENANT_ID, sharedBody);
      expect(result).not.toEqual({ available: true, fake: "creative-brief-cached" });
      expect(result).toEqual({ available: true, ...JSON.parse(validAnalyzeLlmJson) });
    });
  });

  it("reuses the real TokenBucketRateLimiter without throwing when constructed with the LLM capacity/window", () => {
    const limiter = new TokenBucketRateLimiter({ capacity: 10, refillWindowMs: 60_000 });
    expect(limiter.tryConsume().ok).toBe(true);
  });
});
