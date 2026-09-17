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
import type { AdCopyVariantsRequestDto } from "./dto/ad-copy-variants.dto.js";
import type { AnalyzeRequestDto } from "./dto/analyze.dto.js";
import type { AssetInsightRequestDto } from "./dto/asset-insight.dto.js";
import type { CampaignInsightRequestDto } from "./dto/campaign-insight.dto.js";
import type { CampaignStrategyRequestDto } from "./dto/campaign-strategy.dto.js";
import type { CreativeBriefRequestDto } from "./dto/creative-brief.dto.js";
import type { DailyInsightRequestDto } from "./dto/daily-insight.dto.js";
import type { DiagnoseAdCopyRequestDto } from "./dto/diagnose-ad-copy.dto.js";
import type { DiverseCreativeBriefSetRequestDto } from "./dto/diverse-creative-brief-set.dto.js";
import type { GenerateCaptionRequestDto } from "./dto/generate-caption.dto.js";
import type { GenerateHashtagsRequestDto } from "./dto/generate-hashtags.dto.js";
import type { ImprovementPlanRequestDto } from "./dto/improvement-plan.dto.js";
import type { PhotoAnalysisRequestDto } from "./dto/photo-analysis.dto.js";
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
      kaiTake: "Audiens BROAD punya sinyal terbaik untuk digarap lagi dengan angle baru.",
      samanthaVerdict: "Audiens BROAD paling efisien untuk aset ini dengan CPL terendah — scale.",
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

  describe("campaignInsight", () => {
    const validCampaignInsightBody: CampaignInsightRequestDto = {
      campaignId: "camp-1",
      campaignName: "Xpander Bintaro",
      verdict: "SCALE",
      spend: 2_500_000,
      totalLead: 12,
      clicks: 340,
      impressions: 15_000,
      maxFrequency: 2.1,
      adCount: 4,
      adSetCount: 2,
      cpl: 208_333,
      benchmarkCplIDR: 250_000,
      dailyBudget: 750_000,
      cpc: 7_353,
      cpm: 166_667,
      reach: 12_000,
    };

    const validCampaignInsightLlmJson = JSON.stringify({
      triage: { level: "SEHAT", why: "CPL 17% di bawah benchmark, frequency masih aman di 2.1x." },
      verdict: "SCALE",
      confidence: 82,
      verdictOneLiner:
        "CPL Rp208rb 17% di bawah benchmark Rp250rb — worth scale sebelum frequency naik.",
      rootCause: {
        primary: "Creative masih fresh, CTR masih responsif terhadap audience saat ini.",
        primaryEvidence: "CPL Rp208rb vs benchmark Rp250rb, frequency baru 2.1x.",
        ruled_out: "Bukan sinyal creative fatigue — frequency masih jauh dari 2.5x.",
      },
      metricBreakdown: [
        {
          metric: "CPL Rp208rb",
          status: "good",
          interpretation: "17% lebih murah dari benchmark",
          vsContext: "vs benchmark akun Rp250rb",
          trend: "stabil",
          trendDetail: "Belum ada tanda kenaikan CPL",
        },
        {
          metric: "Frequency 2.1x",
          status: "good",
          interpretation: "masih aman, jauh dari batas jenuh",
          vsContext: "vs threshold jenuh 2.5x",
          trend: "stabil",
          trendDetail: "Naik perlahan, belum mengkhawatirkan",
        },
        {
          metric: "CTR",
          status: "neutral",
          interpretation: "audience masih responsif",
          vsContext: "vs rata-rata properti 2-4%",
          trend: "stabil",
          trendDetail: "Belum ada data tren yang cukup",
        },
      ],
      whatHappened:
        "Campaign ini berjalan stabil dengan CPL yang lebih murah dari benchmark akun. Frequency masih terkendali sehingga belum ada tanda kejenuhan creative.",
      playbook: {
        immediate: {
          action: "Naikkan budget 20% mumpung CPL efisien.",
          how: "Naikkan daily budget dari Rp750rb ke Rp900rb di Meta Ads Manager.",
          why: "CPL masih 17% di bawah benchmark — ruang untuk scale masih ada.",
          expectedResult: "+5-8 leads/minggu tanpa CPL naik signifikan.",
        },
        shortTerm: {
          action: "Pantau frequency setiap hari.",
          how: "Cek dashboard campaign setiap pagi, waspada kalau tembus 2.5x.",
          why: "Frequency naik seiring budget naik — perlu diawasi sebelum jenuh.",
          expectedResult: "Deteksi dini kalau creative mulai jenuh.",
        },
        mediumTerm: {
          action: "Siapkan 2-3 creative baru sebagai cadangan.",
          how: "Brief Kai untuk angle baru sebelum frequency tembus 2.5x.",
          why: "Supaya scale bisa berlanjut tanpa jeda saat creative saat ini jenuh.",
          expectedResult: "Campaign bisa terus scale 2-4 minggu ke depan.",
        },
      },
      kaiDirective: { needed: false },
      budgetDecision: {
        recommendation: "increase",
        currentBudget: 750_000,
        recommendedBudget: 900_000,
        changePercent: 20,
        reasoning: "CPL masih di bawah benchmark, ruang scale masih ada.",
      },
      scenarios: [
        {
          name: "Scale bertahap (recommended)",
          probability: "70%",
          steps: ["Naikkan budget 20%", "Pantau frequency mingguan"],
          expectedOutcome: "+5-8 leads/minggu dengan CPL terjaga.",
          timeToResult: "5-7 hari",
        },
        {
          name: "Pertahankan budget saat ini",
          probability: "30%",
          steps: ["Biarkan budget tetap", "Fokus ke campaign lain"],
          expectedOutcome: "Performa stabil tanpa risiko tambahan.",
          timeToResult: "N/A",
        },
      ],
      learnings: ["CPL rendah + frequency rendah = ruang scale aman sebelum creative fatigue."],
    });

    it("returns available:true with a real, Zod-validated diagnosis + metricEvidence + actions from a mocked OpenAI response", async () => {
      registerOpenAiChatHandler(validCampaignInsightLlmJson);
      const service = buildService();
      const result = await service.campaignInsight(TENANT_ID, validCampaignInsightBody);
      expect(result).toEqual({ available: true, ...JSON.parse(validCampaignInsightLlmJson) });
    });

    it("returns NO_API_KEY (no fabricated narrative) when OPENAI_API_KEY is empty", async () => {
      const service = buildService({ apiKey: "" });
      const result = await service.campaignInsight(TENANT_ID, validCampaignInsightBody);
      expect(result).toEqual({
        available: false,
        reason: "NO_API_KEY",
        message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
      });
    });

    it("returns PROVIDER_ERROR (no fabricated narrative) when the OpenAI call fails", async () => {
      registerOpenAiErrorHandler(503);
      const service = buildService();
      const result = await service.campaignInsight(TENANT_ID, validCampaignInsightBody);
      expect(result).toEqual({
        available: false,
        reason: "PROVIDER_ERROR",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE (no fabricated narrative) when OpenAI returns malformed JSON", async () => {
      registerOpenAiChatHandler("not json at all {{{");
      const service = buildService();
      const result = await service.campaignInsight(TENANT_ID, validCampaignInsightBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns RATE_LIMITED when the local budget is exhausted", async () => {
      const service = buildService({ rateLimiter: new AlwaysRateLimitedLimiter() });
      const result = await service.campaignInsight(TENANT_ID, validCampaignInsightBody);
      expect(result).toEqual({
        available: false,
        reason: "RATE_LIMITED",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("caches a successful response, never re-calling OpenAI for an identical body", async () => {
      registerOpenAiChatHandler(validCampaignInsightLlmJson);
      const service = buildService();
      const first = await service.campaignInsight(TENANT_ID, validCampaignInsightBody);
      mswServer.resetHandlers(); // no handler registered — a second real call would fail
      const second = await service.campaignInsight(TENANT_ID, validCampaignInsightBody);
      expect(second).toEqual(first);
    });

    // SAMANTHA ADVANCED SPRINT 2 — the richer, real per-ad/learning-phase/market-digest context
    // must actually reach the LLM's user message, not just validate against the schema.
    it("still accepts (no fabricated narrative) a pre-Sprint-2 body with no ads/learningAdSetStableIds/marketDigest fields", async () => {
      registerOpenAiChatHandler(validCampaignInsightLlmJson);
      const service = buildService();
      const result = await service.campaignInsight(TENANT_ID, validCampaignInsightBody);
      expect(result).toEqual({ available: true, ...JSON.parse(validCampaignInsightLlmJson) });
    });

    it("threads the real per-ad breakdown, learning-phase ad sets, and market digest into the actual LLM user-message payload", async () => {
      const richBody: CampaignInsightRequestDto = {
        ...validCampaignInsightBody,
        ads: [
          {
            stableId: "#C014",
            name: "Xpander Promo A",
            verdict: "FIX",
            spend: 900_000,
            conversations: 2,
            rphChatIDR: 450_000,
            frequency: 4.2,
            learningStatus: "SUCCESS",
          },
          {
            stableId: "#C015",
            name: "Xpander Promo B",
            verdict: "SCALE",
            spend: 1_600_000,
            conversations: 10,
            rphChatIDR: 160_000,
            frequency: 1.8,
            learningStatus: "LEARNING",
          },
        ],
        learningAdSetStableIds: ["#B002"],
        marketDigest: "Musim ini sedang low-season untuk properti KPR.",
        ctrTrend7d: [0.02, 0.021, 0.019, 0.022, 0.02, 0.021, 0.022],
      };

      let receivedBody: unknown;
      mswServer.use(
        http.post(`${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`, async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json({
            choices: [{ message: { content: validCampaignInsightLlmJson } }],
          });
        }),
      );

      const service = buildService();
      await service.campaignInsight(TENANT_ID, richBody);

      const messages = (receivedBody as { messages: Array<{ role: string; content: string }> })
        .messages;
      const userMessage = messages[1]?.content ?? "";
      expect(userMessage).toContain("#C014");
      expect(userMessage).toContain("Xpander Promo A");
      expect(userMessage).toContain("#B002");
      expect(userMessage).toContain("Musim ini sedang low-season untuk properti KPR.");
      expect(userMessage).toContain("0.021");
    });

    it("does not force a 'worst ad' callout into the prompt data for a healthy campaign with no underperforming ad and no learning ad sets", async () => {
      const healthyBody: CampaignInsightRequestDto = {
        ...validCampaignInsightBody,
        ads: [
          {
            stableId: "#C020",
            name: "Xpander Healthy A",
            verdict: "SCALE",
            spend: 1_000_000,
            conversations: 20,
            rphChatIDR: 50_000,
            frequency: 1.2,
          },
          {
            stableId: "#C021",
            name: "Xpander Healthy B",
            verdict: "KEEP",
            spend: 800_000,
            conversations: 15,
            rphChatIDR: 53_333.33,
            frequency: 1.5,
          },
        ],
        learningAdSetStableIds: [],
        marketDigest: null,
      };

      let receivedBody: unknown;
      mswServer.use(
        http.post(`${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`, async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json({
            choices: [{ message: { content: validCampaignInsightLlmJson } }],
          });
        }),
      );

      const service = buildService();
      const result = await service.campaignInsight(TENANT_ID, healthyBody);

      expect(result).toEqual({ available: true, ...JSON.parse(validCampaignInsightLlmJson) });
      const messages = (receivedBody as { messages: Array<{ role: string; content: string }> })
        .messages;
      const userMessage = messages[1]?.content ?? "";
      // The real request payload honestly carries an empty learning-ad-set list and a null market
      // digest — never a fabricated non-empty value the client didn't actually provide.
      expect(userMessage).toContain('"learningAdSetStableIds":[]');
      expect(userMessage).toContain('"marketDigest":null');
    });

    // SAMANTHA ADVANCED INSIGHT ENGINE — `competitorContext`/`proTip`/`rootCause.secondary`/
    // `rootCause.ruled_out` must stay genuinely optional — never forced to fabricate one when the
    // model honestly has no real basis to include it.
    it("real bug-class prevention: accepts a response with no competitorContext/proTip/rootCause.secondary at all (never forced to fabricate one)", async () => {
      const jsonWithoutOptionals = JSON.stringify({
        triage: { level: "SEHAT", why: "x" },
        verdict: "SCALE",
        confidence: 70,
        verdictOneLiner: "x",
        rootCause: { primary: "x", primaryEvidence: "x" },
        metricBreakdown: [
          {
            metric: "x",
            status: "good",
            interpretation: "x",
            vsContext: "x",
            trend: "stabil",
            trendDetail: "x",
          },
          {
            metric: "y",
            status: "good",
            interpretation: "y",
            vsContext: "y",
            trend: "stabil",
            trendDetail: "y",
          },
          {
            metric: "z",
            status: "good",
            interpretation: "z",
            vsContext: "z",
            trend: "stabil",
            trendDetail: "z",
          },
        ],
        whatHappened: "x",
        playbook: {
          immediate: { action: "x", how: "x", why: "x", expectedResult: "x" },
          shortTerm: { action: "x", how: "x", why: "x", expectedResult: "x" },
          mediumTerm: { action: "x", how: "x", why: "x", expectedResult: "x" },
        },
        kaiDirective: { needed: false },
        budgetDecision: {
          recommendation: "maintain",
          currentBudget: 750_000,
          recommendedBudget: 750_000,
          changePercent: 0,
          reasoning: "x",
        },
        scenarios: [
          { name: "A", probability: "70%", steps: ["1"], expectedOutcome: "x", timeToResult: "x" },
          { name: "B", probability: "30%", steps: ["1"], expectedOutcome: "x", timeToResult: "x" },
        ],
        learnings: ["x"],
      });
      registerOpenAiChatHandler(jsonWithoutOptionals);
      const service = buildService();
      const result = await service.campaignInsight(TENANT_ID, validCampaignInsightBody);
      expect(result).toEqual({ available: true, ...JSON.parse(jsonWithoutOptionals) });
    });

    it("returns INVALID_RESPONSE when metricBreakdown has fewer than 2 real entries (the real, lenient minimum — no retry loop exists, so this must not be stricter than necessary)", async () => {
      registerOpenAiChatHandler(
        JSON.stringify({
          ...JSON.parse(validCampaignInsightLlmJson),
          metricBreakdown: [
            {
              metric: "x",
              status: "good",
              interpretation: "x",
              vsContext: "x",
              trend: "stabil",
              trendDetail: "x",
            },
          ],
        }),
      );
      const service = buildService();
      const result = await service.campaignInsight(TENANT_ID, validCampaignInsightBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("accepts exactly 2 metricBreakdown entries (the real, lenient minimum)", async () => {
      registerOpenAiChatHandler(
        JSON.stringify({
          ...JSON.parse(validCampaignInsightLlmJson),
          metricBreakdown: [
            {
              metric: "x",
              status: "good",
              interpretation: "x",
              vsContext: "x",
              trend: "stabil",
              trendDetail: "x",
            },
            {
              metric: "y",
              status: "good",
              interpretation: "y",
              vsContext: "y",
              trend: "stabil",
              trendDetail: "y",
            },
          ],
        }),
      );
      const service = buildService();
      const result = await service.campaignInsight(TENANT_ID, validCampaignInsightBody);
      expect(result).toMatchObject({ available: true });
    });

    it("returns INVALID_RESPONSE when scenarios is empty (the real, lenient minimum is 1 — no retry loop exists, so an off-by-one from the prompt's '2 skenario' guidance must not discard an otherwise-real analysis)", async () => {
      registerOpenAiChatHandler(
        JSON.stringify({
          ...JSON.parse(validCampaignInsightLlmJson),
          scenarios: [],
        }),
      );
      const service = buildService();
      const result = await service.campaignInsight(TENANT_ID, validCampaignInsightBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("accepts a single real scenario (the real, lenient minimum, even though the prompt asks for 2)", async () => {
      registerOpenAiChatHandler(
        JSON.stringify({
          ...JSON.parse(validCampaignInsightLlmJson),
          scenarios: [
            {
              name: "A",
              probability: "100%",
              steps: ["1"],
              expectedOutcome: "x",
              timeToResult: "x",
            },
          ],
        }),
      );
      const service = buildService();
      const result = await service.campaignInsight(TENANT_ID, validCampaignInsightBody);
      expect(result).toMatchObject({ available: true });
    });

    // SAMANTHA ADVANCED INSIGHT ENGINE — dailyBudget/cpc/cpm/reach/andromedaDiversity/
    // hotLeadsCount/spendTrend7d/resultsTrend7d/freqTrend7d must actually reach the LLM's user
    // message, not just validate against the schema.
    it("threads the real dailyBudget/cpc/cpm/reach/andromedaDiversity/hotLeadsCount into the actual LLM user-message payload", async () => {
      const enrichedBody: CampaignInsightRequestDto = {
        ...validCampaignInsightBody,
        spendTrend7d: [100_000, 110_000, 120_000],
        resultsTrend7d: [1, 2, 3],
        freqTrend7d: [1.5, 1.8, 2.1],
        andromedaDiversity: {
          status: "LOW_DIVERSITY",
          totalAdCount: 2,
          distinctCreativeAssetCount: 1,
          reasoning: "Hanya 1 creative unik aktif di campaign ini.",
        },
        hotLeadsCount: 5,
      };

      let receivedBody: unknown;
      mswServer.use(
        http.post(`${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`, async ({ request }) => {
          receivedBody = await request.json();
          return HttpResponse.json({
            choices: [{ message: { content: validCampaignInsightLlmJson } }],
          });
        }),
      );

      const service = buildService();
      await service.campaignInsight(TENANT_ID, enrichedBody);

      const messages = (receivedBody as { messages: Array<{ role: string; content: string }> })
        .messages;
      const userMessage = messages[1]?.content ?? "";
      expect(userMessage).toContain('"dailyBudget":750000');
      expect(userMessage).toContain('"cpc":7353');
      expect(userMessage).toContain("LOW_DIVERSITY");
      expect(userMessage).toContain('"hotLeadsCount":5');
    });
  });

  describe("generateAdCopyVariants", () => {
    const validAdCopyVariantsBody: AdCopyVariantsRequestDto = {
      listingTitle: "Cluster Anggrek 2 Bintaro",
      propertyType: "Rumah",
      angle: "DP_RINGAN",
      price: 850_000_000,
      city: "Bintaro",
      highlights: ["3 kamar tidur", "carport 2 mobil"],
    };

    const validAdCopyVariantsLlmJson = JSON.stringify({
      variants: [
        {
          variantLabel: "A",
          primaryText: "DP ringan mulai Rp850jt untuk Cluster Anggrek 2 Bintaro!",
          headline: "Cluster Anggrek DP Ringan",
          description: "3KT, carport 2 mobil",
        },
        {
          variantLabel: "B",
          primaryText: "Lokasi strategis di Bintaro, siap huni nyaman untuk keluarga.",
          headline: "Anggrek 2 Bintaro Nyaman",
          description: "Dekat akses tol & sekolah",
        },
        {
          variantLabel: "C",
          primaryText: "Sudah dipercaya banyak keluarga — cek unit contoh sekarang.",
          headline: "Anggrek 2 Terverifikasi",
          description: "Unit siap survey kapan saja",
        },
      ],
    });

    it("returns available:true with exactly 3 real, Zod-validated variants from a mocked OpenAI response", async () => {
      registerOpenAiChatHandler(validAdCopyVariantsLlmJson);
      const service = buildService();
      const result = await service.generateAdCopyVariants(TENANT_ID, validAdCopyVariantsBody);
      expect(result).toEqual({ available: true, ...JSON.parse(validAdCopyVariantsLlmJson) });
    });

    it("returns NO_API_KEY (no fabricated copy) when OPENAI_API_KEY is empty", async () => {
      const service = buildService({ apiKey: "" });
      const result = await service.generateAdCopyVariants(TENANT_ID, validAdCopyVariantsBody);
      expect(result).toEqual({
        available: false,
        reason: "NO_API_KEY",
        message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
      });
    });

    it("returns PROVIDER_ERROR (no fabricated copy) when the OpenAI call fails", async () => {
      registerOpenAiErrorHandler(503);
      const service = buildService();
      const result = await service.generateAdCopyVariants(TENANT_ID, validAdCopyVariantsBody);
      expect(result).toEqual({
        available: false,
        reason: "PROVIDER_ERROR",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE (no fabricated copy) when OpenAI returns malformed JSON", async () => {
      registerOpenAiChatHandler("not json at all {{{");
      const service = buildService();
      const result = await service.generateAdCopyVariants(TENANT_ID, validAdCopyVariantsBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    // BULK-PUBLISH WIDENING: `AdCopyVariantsLlmPayloadSchema` was `.length(3)` (rejecting any
    // count other than exactly 3); now `.min(1).max(MAX_VARIANT_COUNT)`, the same "an LLM asked for
    // N deliberately-different angles may honestly return fewer than N" convention
    // `DiverseCreativeBriefSetLlmPayloadSchema` already established. A single real, honest variant
    // is therefore a VALID response now, not an error — see the next test for the real invalid case
    // (a genuinely empty array).
    it("honestly ACCEPTS fewer variants than the default 3 (bulk-publish widening: an LLM may honestly return fewer distinct angles than asked)", async () => {
      registerOpenAiChatHandler(
        JSON.stringify({
          variants: [
            {
              variantLabel: "A",
              primaryText: "Only one variant",
              headline: "Only One",
              description: "Not enough angles left",
            },
          ],
        }),
      );
      const service = buildService();
      const result = await service.generateAdCopyVariants(TENANT_ID, validAdCopyVariantsBody);
      expect(result).toEqual({
        available: true,
        variants: [
          {
            variantLabel: "A",
            primaryText: "Only one variant",
            headline: "Only One",
            description: "Not enough angles left",
          },
        ],
      });
    });

    it("returns INVALID_RESPONSE when OpenAI returns zero variants (still real Zod .min(1) check)", async () => {
      registerOpenAiChatHandler(JSON.stringify({ variants: [] }));
      const service = buildService();
      const result = await service.generateAdCopyVariants(TENANT_ID, validAdCopyVariantsBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns RATE_LIMITED when the local budget is exhausted", async () => {
      const service = buildService({ rateLimiter: new AlwaysRateLimitedLimiter() });
      const result = await service.generateAdCopyVariants(TENANT_ID, validAdCopyVariantsBody);
      expect(result).toEqual({
        available: false,
        reason: "RATE_LIMITED",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("caches a successful response, never re-calling OpenAI for an identical body", async () => {
      registerOpenAiChatHandler(validAdCopyVariantsLlmJson);
      const service = buildService();
      const first = await service.generateAdCopyVariants(TENANT_ID, validAdCopyVariantsBody);
      mswServer.resetHandlers(); // no handler registered — a second real call would fail
      const second = await service.generateAdCopyVariants(TENANT_ID, validAdCopyVariantsBody);
      expect(second).toEqual(first);
    });
  });

  describe("generateDiverseCreativeBriefSet (Samantha Andromeda-Aware Campaign System, Sprint 2)", () => {
    const validDiverseBriefSetBody: DiverseCreativeBriefSetRequestDto = {
      listingTitle: "Cluster Anggrek 2 Bintaro",
      propertyType: "Rumah",
      price: 850_000_000,
      city: "Bintaro",
      highlights: ["3 kamar tidur", "carport 2 mobil"],
      targetCount: 3,
      existingAngles: ["DP_RINGAN"],
    };

    const validDiverseBriefSetLlmJson = JSON.stringify({
      briefs: [
        {
          angle: "READY_HUNI",
          format: "IMAGES_ONLY",
          headline: "Anggrek 2 Siap Huni",
          primaryText: "Siap huni, tinggal bawa koper ke Cluster Anggrek 2 Bintaro!",
          description: "Tinggal masuk",
        },
        {
          angle: "INVESTASI",
          format: "IMAGES_ONLY",
          headline: "Anggrek 2 Investasi Cerdas",
          primaryText: "Investasi properti Bintaro yang nilainya terus naik.",
          description: "Lokasi strategis",
        },
        {
          angle: "VIRTUAL_TOUR",
          format: "VIDEO_AND_IMAGES",
          headline: "Anggrek 2 Virtual Tour",
          primaryText: "Yuk lihat virtual tour Cluster Anggrek 2 Bintaro dari HP kamu.",
          description: "Tur video asli",
        },
      ],
    });

    it("returns available:true with real, distinct-angle briefs from a mocked OpenAI response", async () => {
      registerOpenAiChatHandler(validDiverseBriefSetLlmJson);
      const service = buildService();
      const result = await service.generateDiverseCreativeBriefSet(
        TENANT_ID,
        validDiverseBriefSetBody,
      );
      expect(result).toEqual({ available: true, ...JSON.parse(validDiverseBriefSetLlmJson) });
    });

    it("returns NO_API_KEY (no fabricated briefs) when OPENAI_API_KEY is empty", async () => {
      const service = buildService({ apiKey: "" });
      const result = await service.generateDiverseCreativeBriefSet(
        TENANT_ID,
        validDiverseBriefSetBody,
      );
      expect(result).toEqual({
        available: false,
        reason: "NO_API_KEY",
        message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
      });
    });

    it("returns PROVIDER_ERROR (no fabricated briefs) when the OpenAI call fails", async () => {
      registerOpenAiErrorHandler(503);
      const service = buildService();
      const result = await service.generateDiverseCreativeBriefSet(
        TENANT_ID,
        validDiverseBriefSetBody,
      );
      expect(result).toEqual({
        available: false,
        reason: "PROVIDER_ERROR",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE when OpenAI returns malformed JSON", async () => {
      registerOpenAiChatHandler("not json at all {{{");
      const service = buildService();
      const result = await service.generateDiverseCreativeBriefSet(
        TENANT_ID,
        validDiverseBriefSetBody,
      );
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("drops any brief whose angle is already in existingAngles — never trusts the prompt alone", async () => {
      registerOpenAiChatHandler(
        JSON.stringify({
          briefs: [
            {
              // Reused angle — the request's own `existingAngles` includes "DP_RINGAN".
              angle: "DP_RINGAN",
              format: "IMAGES_ONLY",
              headline: "Anggrek 2 DP Ringan (lagi)",
              primaryText: "DP ringan lagi, padahal sudah ada brief dengan angle ini.",
              description: "Duplikat angle",
            },
            {
              angle: "READY_HUNI",
              format: "IMAGES_ONLY",
              headline: "Anggrek 2 Siap Huni",
              primaryText: "Siap huni, tinggal bawa koper ke Cluster Anggrek 2 Bintaro!",
              description: "Tinggal masuk",
            },
          ],
        }),
      );
      const service = buildService();
      const result = await service.generateDiverseCreativeBriefSet(
        TENANT_ID,
        validDiverseBriefSetBody,
      );
      expect(result.available).toBe(true);
      if (result.available) {
        expect(result.briefs).toHaveLength(1);
        expect(result.briefs[0]?.angle).toBe("READY_HUNI");
      }
    });

    it("drops a duplicate angle appearing twice within the same response, keeping only the first", async () => {
      registerOpenAiChatHandler(
        JSON.stringify({
          briefs: [
            {
              angle: "READY_HUNI",
              format: "IMAGES_ONLY",
              headline: "Anggrek 2 Siap Huni (A)",
              primaryText: "Siap huni versi A.",
              description: "Versi A",
            },
            {
              angle: "READY_HUNI",
              format: "IMAGES_ONLY",
              headline: "Anggrek 2 Siap Huni (B)",
              primaryText: "Siap huni versi B — angle sama dengan yang di atas.",
              description: "Versi B",
            },
          ],
        }),
      );
      const service = buildService();
      const result = await service.generateDiverseCreativeBriefSet(
        TENANT_ID,
        validDiverseBriefSetBody,
      );
      expect(result.available).toBe(true);
      if (result.available) {
        expect(result.briefs).toHaveLength(1);
        expect(result.briefs[0]?.headline).toBe("Anggrek 2 Siap Huni (A)");
      }
    });

    it("returns INVALID_RESPONSE when every returned brief is filtered out (all angles already in use)", async () => {
      registerOpenAiChatHandler(
        JSON.stringify({
          briefs: [
            {
              angle: "DP_RINGAN",
              format: "IMAGES_ONLY",
              headline: "Anggrek 2 DP Ringan",
              primaryText: "DP ringan lagi.",
              description: "Duplikat",
            },
          ],
        }),
      );
      const service = buildService();
      const result = await service.generateDiverseCreativeBriefSet(
        TENANT_ID,
        validDiverseBriefSetBody,
      );
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("truncates surviving briefs to targetCount when the LLM honestly returns more", async () => {
      registerOpenAiChatHandler(validDiverseBriefSetLlmJson);
      const service = buildService();
      const result = await service.generateDiverseCreativeBriefSet(TENANT_ID, {
        ...validDiverseBriefSetBody,
        targetCount: 2,
      });
      expect(result.available).toBe(true);
      if (result.available) {
        expect(result.briefs).toHaveLength(2);
      }
    });

    it("returns RATE_LIMITED when the local budget is exhausted", async () => {
      const service = buildService({ rateLimiter: new AlwaysRateLimitedLimiter() });
      const result = await service.generateDiverseCreativeBriefSet(
        TENANT_ID,
        validDiverseBriefSetBody,
      );
      expect(result).toEqual({
        available: false,
        reason: "RATE_LIMITED",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("caches a successful response, never re-calling OpenAI for an identical body", async () => {
      registerOpenAiChatHandler(validDiverseBriefSetLlmJson);
      const service = buildService();
      const first = await service.generateDiverseCreativeBriefSet(
        TENANT_ID,
        validDiverseBriefSetBody,
      );
      mswServer.resetHandlers(); // no handler registered — a second real call would fail
      const second = await service.generateDiverseCreativeBriefSet(
        TENANT_ID,
        validDiverseBriefSetBody,
      );
      expect(second).toEqual(first);
    });
  });

  describe("analyzePropertyPhoto (Kai Creative Engine, Sprint 1)", () => {
    const validPhotoAnalysisBody: PhotoAnalysisRequestDto = {
      photoUrl: "https://storage.example.com/listings/photo-1.jpg",
    };

    const validPhotoAnalysisLlmJson = JSON.stringify({
      scene: "EKSTERIOR",
      qualityScore: 82,
      marketingScore: 74,
      recommendedUse: "HERO",
      reasoning: "Foto tampak depan rumah dengan pencahayaan alami yang baik.",
    });

    it("returns available:true with the real analysis from a mocked OpenAI vision response", async () => {
      registerOpenAiChatHandler(validPhotoAnalysisLlmJson);
      const service = buildService();
      const result = await service.analyzePropertyPhoto(TENANT_ID, validPhotoAnalysisBody);
      expect(result).toEqual({ available: true, ...JSON.parse(validPhotoAnalysisLlmJson) });
    });

    it("returns NO_API_KEY (no fabricated analysis) when OPENAI_API_KEY is empty", async () => {
      const service = buildService({ apiKey: "" });
      const result = await service.analyzePropertyPhoto(TENANT_ID, validPhotoAnalysisBody);
      expect(result).toEqual({
        available: false,
        reason: "NO_API_KEY",
        message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
      });
    });

    it("returns PROVIDER_ERROR (no fabricated analysis) when the OpenAI call fails", async () => {
      registerOpenAiErrorHandler(503);
      const service = buildService();
      const result = await service.analyzePropertyPhoto(TENANT_ID, validPhotoAnalysisBody);
      expect(result).toEqual({
        available: false,
        reason: "PROVIDER_ERROR",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE when OpenAI returns malformed JSON", async () => {
      registerOpenAiChatHandler("not json at all {{{");
      const service = buildService();
      const result = await service.analyzePropertyPhoto(TENANT_ID, validPhotoAnalysisBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE when the model invents a scene value outside the small, real vocabulary", async () => {
      registerOpenAiChatHandler(
        JSON.stringify({
          scene: "BALKON", // not in PHOTO_SCENE_VALUES — never trusted from the prompt alone
          qualityScore: 80,
          marketingScore: 70,
          recommendedUse: "HERO",
          reasoning: "x",
        }),
      );
      const service = buildService();
      const result = await service.analyzePropertyPhoto(TENANT_ID, validPhotoAnalysisBody);
      expect(result.available).toBe(false);
    });

    it("returns RATE_LIMITED (no fabricated analysis) when the local rate limiter is exhausted", async () => {
      const service = buildService({ rateLimiter: new AlwaysRateLimitedLimiter() });
      const result = await service.analyzePropertyPhoto(TENANT_ID, validPhotoAnalysisBody);
      expect(result).toEqual({
        available: false,
        reason: "RATE_LIMITED",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("caches a successful response, never re-calling OpenAI for the same photo URL", async () => {
      registerOpenAiChatHandler(validPhotoAnalysisLlmJson);
      const service = buildService();
      const first = await service.analyzePropertyPhoto(TENANT_ID, validPhotoAnalysisBody);
      mswServer.resetHandlers(); // no handler registered — a second real call would fail
      const second = await service.analyzePropertyPhoto(TENANT_ID, validPhotoAnalysisBody);
      expect(second).toEqual(first);
    });
  });

  describe("diagnoseAdCopy (AAOS Samantha Professional Optimizer, Part C)", () => {
    const validDiagnoseBody: DiagnoseAdCopyRequestDto = {
      adName: "Xpander Cross 2023 - Bintaro",
      primaryText: "DP ringan mulai 15 juta, cicilan mulai 2 jutaan!",
      headline: "Xpander Cross DP Ringan",
      description: "Unit siap survey hari ini",
      verdict: "REVIEW",
      isUnderperforming: true,
      spend: 1_200_000,
      conversations: 3,
      rphChatIDR: 400_000,
      frequency: 1.8,
      learningStatus: undefined,
    };

    const validDiagnoseLlmJson = JSON.stringify({
      structural: {
        hook: { status: "YES", reasoning: "Membuka dengan DP ringan, langsung menarik perhatian." },
        clearProblem: {
          status: "PARTIAL",
          reasoning: "Menyinggung cicilan tapi tidak menyebut masalah spesifik pembeli.",
        },
        toThePoint: { status: "YES", reasoning: "Singkat, dua kalimat saja." },
        softCta: { status: "NO", reasoning: "Tidak ada ajakan bertindak sama sekali di teks." },
      },
      diagnosis: {
        issue: "USP",
        reasoning: "Tidak ada pembeda dari dealer lain yang jual unit sama.",
      },
    });

    it("returns available:true with real, Zod-validated structural + diagnosis output from a mocked OpenAI response", async () => {
      registerOpenAiChatHandler(validDiagnoseLlmJson);
      const service = buildService();
      const result = await service.diagnoseAdCopy(TENANT_ID, validDiagnoseBody);
      expect(result).toEqual({ available: true, ...JSON.parse(validDiagnoseLlmJson) });
    });

    it("returns NO_COPY_TEXT (never calling OpenAI) when primaryText/headline/description are all undefined", async () => {
      const service = buildService();
      const result = await service.diagnoseAdCopy(TENANT_ID, {
        ...validDiagnoseBody,
        primaryText: undefined,
        headline: undefined,
        description: undefined,
      });
      expect(result).toEqual({
        available: false,
        reason: "NO_COPY_TEXT",
        message:
          "Teks iklan tidak tersedia dari Meta untuk tipe creative ini, tidak bisa dianalisis",
      });
    });

    it("still calls the LLM when only ONE of primaryText/headline/description is present", async () => {
      registerOpenAiChatHandler(validDiagnoseLlmJson);
      const service = buildService();
      const result = await service.diagnoseAdCopy(TENANT_ID, {
        ...validDiagnoseBody,
        headline: undefined,
        description: undefined,
      });
      expect(result).toEqual({ available: true, ...JSON.parse(validDiagnoseLlmJson) });
    });

    it("returns NO_API_KEY (no fabricated diagnosis) when OPENAI_API_KEY is empty", async () => {
      const service = buildService({ apiKey: "" });
      const result = await service.diagnoseAdCopy(TENANT_ID, validDiagnoseBody);
      expect(result).toEqual({
        available: false,
        reason: "NO_API_KEY",
        message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
      });
    });

    it("returns PROVIDER_ERROR (no fabricated diagnosis) when the OpenAI call fails", async () => {
      registerOpenAiErrorHandler(503);
      const service = buildService();
      const result = await service.diagnoseAdCopy(TENANT_ID, validDiagnoseBody);
      expect(result).toEqual({
        available: false,
        reason: "PROVIDER_ERROR",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns INVALID_RESPONSE (no fabricated diagnosis) when OpenAI returns malformed JSON", async () => {
      registerOpenAiChatHandler("not json at all {{{");
      const service = buildService();
      const result = await service.diagnoseAdCopy(TENANT_ID, validDiagnoseBody);
      expect(result).toEqual({
        available: false,
        reason: "INVALID_RESPONSE",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("returns RATE_LIMITED when the local budget is exhausted", async () => {
      const service = buildService({ rateLimiter: new AlwaysRateLimitedLimiter() });
      const result = await service.diagnoseAdCopy(TENANT_ID, validDiagnoseBody);
      expect(result).toEqual({
        available: false,
        reason: "RATE_LIMITED",
        message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
      });
    });

    it("caches a successful response, never re-calling OpenAI for an identical body", async () => {
      registerOpenAiChatHandler(validDiagnoseLlmJson);
      const service = buildService();
      const first = await service.diagnoseAdCopy(TENANT_ID, validDiagnoseBody);
      mswServer.resetHandlers(); // no handler registered — a second real call would fail
      const second = await service.diagnoseAdCopy(TENANT_ID, validDiagnoseBody);
      expect(second).toEqual(first);
    });

    it("does NOT cache the early NO_COPY_TEXT short-circuit against a later call with real copy text present (different bodies, different cache keys)", async () => {
      const service = buildService();
      const noCopyResult = await service.diagnoseAdCopy(TENANT_ID, {
        ...validDiagnoseBody,
        primaryText: undefined,
        headline: undefined,
        description: undefined,
      });
      expect(noCopyResult).toEqual({
        available: false,
        reason: "NO_COPY_TEXT",
        message:
          "Teks iklan tidak tersedia dari Meta untuk tipe creative ini, tidak bisa dianalisis",
      });
      registerOpenAiChatHandler(validDiagnoseLlmJson);
      const withCopyResult = await service.diagnoseAdCopy(TENANT_ID, validDiagnoseBody);
      expect(withCopyResult).toEqual({ available: true, ...JSON.parse(validDiagnoseLlmJson) });
    });

    it("includes a real learningPhaseNote in the validated response when the LLM provides one for a LEARNING adset", async () => {
      const learningLlmJson = JSON.stringify({
        ...JSON.parse(validDiagnoseLlmJson),
        learningPhaseNote:
          "Adset masih dalam Learning Phase Meta, diagnosis di atas perlu dilihat dengan hati-hati.",
      });
      registerOpenAiChatHandler(learningLlmJson);
      const service = buildService();
      const result = await service.diagnoseAdCopy(TENANT_ID, {
        ...validDiagnoseBody,
        learningStatus: "LEARNING",
      });
      expect(result).toEqual({ available: true, ...JSON.parse(learningLlmJson) });
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
