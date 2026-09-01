import { TokenBucketRateLimiter, type IRateLimiter } from "@aos/meta-ads-connector";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  createFakeSupabaseClient,
  type FakeSupabaseClient,
} from "../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../test-support/fixtures.js";
import { mswServer, registerOpenAiChatHandler } from "../../test-support/openai-msw.js";
import { AgentRunsService } from "../agent-runs/agent-runs.service.js";
import { AgentRunRepository } from "../agent-runs/infrastructure/agent-run.repository.js";
import type { LearningService } from "../learning/learning.service.js";
import { ResponseCache } from "../llm/cache/ResponseCache.js";
import { OpenAiClient } from "../llm/infrastructure/OpenAiClient.js";
import { LlmService } from "../llm/llm.service.js";
import { PromptOverrideRepository } from "../prompt-override/infrastructure/prompt-override.repository.js";
import { PromptOverrideService } from "../prompt-override/prompt-override.service.js";

import { AiJudgeService } from "./ai-judge.service.js";
import { JudgeResultRepository } from "./infrastructure/judge-result.repository.js";

const TENANT_ID = "dss-motor";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

/** A real `LlmService` — gated NO_API_KEY by default (empty `OPENAI_API_KEY`, `buildTestConfig`'s own real default), so it never makes a real network call unless a test explicitly configures a key. */
function buildRealLlmService(apiKey = ""): LlmService {
  const config = buildTestConfig({ OPENAI_API_KEY: apiKey });
  const client = new OpenAiClient({ apiKey: config.OPENAI_API_KEY });
  const rateLimiter: IRateLimiter = new TokenBucketRateLimiter({
    capacity: 10,
    refillWindowMs: 60_000,
  });
  const cache = new ResponseCache<unknown>();
  const promptOverride = new PromptOverrideService(
    new PromptOverrideRepository(createFakeSupabaseClient()),
  );
  return new LlmService(config, client, rateLimiter, cache, promptOverride);
}

/** A fake `LearningService` whose `onAgentRunJudged` is a plain spy — real wiring assertions (Phase J3) check THIS spy's call args, never a second real `LearningService` instance's internal logic (that's `learning.service.spec.ts`'s own job). */
function buildFakeLearningService(): LearningService & {
  readonly onAgentRunJudgedSpy: ReturnType<typeof vi.fn>;
} {
  const onAgentRunJudgedSpy = vi.fn(async () => undefined);
  return {
    onAgentRunJudgedSpy,
    onAgentRunJudged: onAgentRunJudgedSpy,
  } as unknown as LearningService & { readonly onAgentRunJudgedSpy: ReturnType<typeof vi.fn> };
}

function buildService(
  client: FakeSupabaseClient = createFakeSupabaseClient(),
  llmService: LlmService = buildRealLlmService(),
  learningService: LearningService = buildFakeLearningService(),
): {
  readonly client: FakeSupabaseClient;
  readonly agentRuns: AgentRunsService;
  readonly repository: JudgeResultRepository;
  readonly learningService: LearningService;
  readonly service: AiJudgeService;
} {
  const agentRuns = new AgentRunsService(new AgentRunRepository(client));
  const repository = new JudgeResultRepository(client);
  return {
    client,
    agentRuns,
    repository,
    learningService,
    service: new AiJudgeService(agentRuns, llmService, repository, learningService),
  };
}

const validSamanthaJudgeJson = JSON.stringify({
  scores: {
    ai_availability: 90,
    coverage: 80,
    verdict_actionability: 70,
    trend_consistency: 75,
    overall: 79,
  },
  strengths: ["Analisa mencakup seluruh campaign aktif."],
  gaps: [
    {
      dimension: "verdict_actionability",
      score: 70,
      issue: "Tidak ada verdict SCALE meski ada iklan berperforma baik.",
      severity: "MEDIUM",
      suggestion: "Tinjau ulang threshold SCALE.",
    },
  ],
  trend: "STABLE",
  notes: "Run ini konsisten dengan riwayat sebelumnya.",
});

const validKaiJudgeJson = JSON.stringify({
  scores: {
    generation_success: 95,
    format_decision_quality: 80,
    copy_variant_breadth: 60,
    model_confidence: 85,
    overall: 80,
  },
  strengths: ["Generasi selesai tanpa error."],
  gaps: [
    {
      dimension: "copy_variant_breadth",
      score: 60,
      issue: "Hanya 1 varian copy dihasilkan.",
      severity: "MEDIUM",
      suggestion: "Generate minimal 2 varian untuk A/B test.",
    },
  ],
  trend: "IMPROVING",
  notes: "Kualitas format decision baik.",
});

const validClaraJudgeJson = JSON.stringify({
  scores: {
    outcome_completeness: 85,
    commission_plausibility: 70,
    closing_type_consistency: 90,
    trend_consistency: 80,
    overall: 82,
  },
  strengths: ["Record closing lengkap dengan commission."],
  gaps: [],
  trend: "STABLE",
  notes: "Closing record cukup lengkap.",
});

describe("AiJudgeService.judgeRun", () => {
  it("SAMANTHA: loads the real agent_runs row, calls the real judge prompt, and persists a validated judge_results row", async () => {
    registerOpenAiChatHandler(validSamanthaJudgeJson);
    const { client, agentRuns, service } = buildService(
      createFakeSupabaseClient(),
      buildRealLlmService("test-openai-key"),
    );
    const runId = await agentRuns.record(TENANT_ID, "SAMANTHA", "evt-1", {
      campaigns: 3,
      totalAds: 10,
      pause: 1,
      scale: 0,
      aiAvailable: true,
    });

    await service.judgeRun(TENANT_ID, runId as string);

    const rows = client.rows("judge_results");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tenant_id: TENANT_ID,
      agent: "SAMANTHA",
      run_id: runId,
      scores: JSON.parse(validSamanthaJudgeJson).scores,
      notes: "Run ini konsisten dengan riwayat sebelumnya.",
    });
  });

  it("KAI: uses the real, separate Kai judge dimension schema", async () => {
    registerOpenAiChatHandler(validKaiJudgeJson);
    const { client, agentRuns, service } = buildService(
      createFakeSupabaseClient(),
      buildRealLlmService("test-openai-key"),
    );
    const runId = await agentRuns.record(TENANT_ID, "KAI", "pkg-1", {
      vertical: "AUTOMOTIVE",
      angle: "DP_RINGAN",
      requestedFormat: "IMAGE_SQUARE",
      decidedFormat: "IMAGE_SQUARE",
      status: "COMPLETE",
      copyVariantCount: 1,
      aiModel: "gpt-image-1",
      confidenceScore: 0.9,
    });

    await service.judgeRun(TENANT_ID, runId as string);

    const rows = client.rows("judge_results");
    expect(rows[0]).toMatchObject({
      agent: "KAI",
      run_id: runId,
      scores: JSON.parse(validKaiJudgeJson).scores,
    });
  });

  it("CLARA: uses the real, separate Clara judge dimension schema", async () => {
    registerOpenAiChatHandler(validClaraJudgeJson);
    const { client, agentRuns, service } = buildService(
      createFakeSupabaseClient(),
      buildRealLlmService("test-openai-key"),
    );
    const runId = await agentRuns.record(TENANT_ID, "CLARA", "lead-1", {
      closingType: "SPK",
      branchId: "BINTARO",
      unitModel: "Xpander",
      commissionPct: 3,
    });

    await service.judgeRun(TENANT_ID, runId as string);

    const rows = client.rows("judge_results");
    expect(rows[0]).toMatchObject({
      agent: "CLARA",
      run_id: runId,
      scores: JSON.parse(validClaraJudgeJson).scores,
    });
  });

  describe("LLM-unavailable degrade (never fabricates a score)", () => {
    it("does NOT persist a judge_results row when OPENAI_API_KEY is unset (NO_API_KEY)", async () => {
      const { client, agentRuns, service } = buildService(
        createFakeSupabaseClient(),
        buildRealLlmService(""),
      );
      const runId = await agentRuns.record(TENANT_ID, "SAMANTHA", "evt-2", {
        campaigns: 1,
        totalAds: 1,
        pause: 0,
        scale: 0,
        aiAvailable: false,
      });

      await service.judgeRun(TENANT_ID, runId as string);

      expect(client.rows("judge_results")).toHaveLength(0);
    });

    it("does NOT persist a judge_results row when the LLM response fails Zod validation", async () => {
      registerOpenAiChatHandler("not valid json {{{");
      const { client, agentRuns, service } = buildService(
        createFakeSupabaseClient(),
        buildRealLlmService("test-openai-key"),
      );
      const runId = await agentRuns.record(TENANT_ID, "SAMANTHA", "evt-3", {
        campaigns: 1,
        totalAds: 1,
        pause: 0,
        scale: 0,
        aiAvailable: true,
      });

      await service.judgeRun(TENANT_ID, runId as string);

      expect(client.rows("judge_results")).toHaveLength(0);
    });
  });

  describe("real judge-memory (recent judge_results for this tenant+agent)", () => {
    it("feeds the correct recent rows (this tenant+agent only, oldest-first) as memory into the judge prompt", async () => {
      const client = createFakeSupabaseClient();
      const { agentRuns, service } = buildService(client, buildRealLlmService("test-openai-key"));

      // Seed judge_results history directly (bypassing `repository.insert`'s own
      // `new Date().toISOString()` — 2 inserts made synchronously back-to-back can land on the
      // SAME millisecond, which would make ordering non-deterministic for this test): 2 real prior
      // SAMANTHA judgments for this tenant with distinct, explicit `created_at` values, 1 for a
      // DIFFERENT tenant (must be excluded), 1 for a different agent (must be excluded).
      client.seed("judge_results", {
        id: "aaaaaaaa-1111-4111-8111-111111111111",
        tenant_id: TENANT_ID,
        agent: "SAMANTHA",
        run_id: "11111111-1111-4111-8111-111111111111",
        scores: { overall: 60 },
        strengths: [],
        gaps: [],
        notes: "run 1",
        created_at: "2026-08-01T00:00:00.000Z",
      });
      client.seed("judge_results", {
        id: "aaaaaaaa-2222-4222-8222-222222222222",
        tenant_id: TENANT_ID,
        agent: "SAMANTHA",
        run_id: "22222222-2222-4222-8222-222222222222",
        scores: { overall: 80 },
        strengths: [],
        gaps: [],
        notes: "run 2",
        created_at: "2026-08-02T00:00:00.000Z",
      });
      client.seed("judge_results", {
        id: "aaaaaaaa-3333-4333-8333-333333333333",
        tenant_id: "other-tenant",
        agent: "SAMANTHA",
        run_id: "33333333-3333-4333-8333-333333333333",
        scores: { overall: 10 },
        strengths: [],
        gaps: [],
        notes: "other tenant",
        created_at: "2026-08-03T00:00:00.000Z",
      });
      client.seed("judge_results", {
        id: "aaaaaaaa-4444-4444-8444-444444444444",
        tenant_id: TENANT_ID,
        agent: "KAI",
        run_id: "44444444-4444-4444-8444-444444444444",
        scores: { overall: 5 },
        strengths: [],
        gaps: [],
        notes: "other agent",
        created_at: "2026-08-04T00:00:00.000Z",
      });

      let capturedMemory: unknown;
      mswServer.use(
        http.post("https://api.openai.com/v1/chat/completions", async ({ request }) => {
          const body = (await request.json()) as {
            messages: readonly { role: string; content: string }[];
          };
          const userMessage = body.messages.find((message) => message.role === "user");
          capturedMemory = JSON.parse(userMessage?.content ?? "{}").memory;
          return HttpResponse.json({
            id: "chatcmpl-test",
            object: "chat.completion",
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: validSamanthaJudgeJson },
                finish_reason: "stop",
              },
            ],
          });
        }),
      );

      const runId = await agentRuns.record(TENANT_ID, "SAMANTHA", "evt-4", {
        campaigns: 2,
        totalAds: 5,
        pause: 0,
        scale: 1,
        aiAvailable: true,
      });
      await service.judgeRun(TENANT_ID, runId as string);

      expect(capturedMemory).toEqual({
        recent: [
          { createdAt: expect.any(String), overall: 60 },
          { createdAt: expect.any(String), overall: 80 },
        ],
        averageOverall: 70,
      });
    });
  });

  describe("AAOS-AI-JUDGE-SELF-IMPROVING, Phase J3 — real trigger wiring into LearningService", () => {
    it("calls LearningService.onAgentRunJudged with the real tenantId/agentRunId/agent/scores-gaps-trend, AFTER the judge_results row is persisted", async () => {
      registerOpenAiChatHandler(validSamanthaJudgeJson);
      const learningService = buildFakeLearningService();
      const { client, agentRuns, service } = buildService(
        createFakeSupabaseClient(),
        buildRealLlmService("test-openai-key"),
        learningService,
      );
      const runId = await agentRuns.record(TENANT_ID, "SAMANTHA", "evt-j3-1", {
        campaigns: 3,
        totalAds: 10,
        pause: 1,
        scale: 0,
        aiAvailable: true,
      });

      await service.judgeRun(TENANT_ID, runId as string);

      // The judge_results row already exists by the time onAgentRunJudged is called — proves this
      // is wired AFTER persistence, not before (the real trigger-point decision this phase made).
      expect(client.rows("judge_results")).toHaveLength(1);
      expect(learningService.onAgentRunJudgedSpy).toHaveBeenCalledTimes(1);
      expect(learningService.onAgentRunJudgedSpy).toHaveBeenCalledWith(
        TENANT_ID,
        runId,
        "SAMANTHA",
        expect.objectContaining({
          scores: JSON.parse(validSamanthaJudgeJson).scores,
          gaps: JSON.parse(validSamanthaJudgeJson).gaps,
          trend: "STABLE",
        }),
      );
    });

    it("does NOT call LearningService.onAgentRunJudged when no judge_results row was written (LLM unavailable)", async () => {
      const learningService = buildFakeLearningService();
      const { agentRuns, service } = buildService(
        createFakeSupabaseClient(),
        buildRealLlmService(""),
        learningService,
      );
      const runId = await agentRuns.record(TENANT_ID, "SAMANTHA", "evt-j3-2", {
        campaigns: 1,
        totalAds: 1,
        pause: 0,
        scale: 0,
        aiAvailable: false,
      });

      await service.judgeRun(TENANT_ID, runId as string);

      expect(learningService.onAgentRunJudgedSpy).not.toHaveBeenCalled();
    });

    it("never throws — a LearningService.onAgentRunJudged failure at this trigger point is caught and swallowed, and the already-persisted judge_results row is unaffected (best-effort discipline, same as judgeRun's own outer try/catch)", async () => {
      registerOpenAiChatHandler(validSamanthaJudgeJson);
      const learningService = {
        onAgentRunJudged: vi.fn(async () => {
          throw new Error("boom — proposal generation failed");
        }),
      } as unknown as LearningService;
      const { client, agentRuns, service } = buildService(
        createFakeSupabaseClient(),
        buildRealLlmService("test-openai-key"),
        learningService,
      );
      const runId = await agentRuns.record(TENANT_ID, "SAMANTHA", "evt-j3-3", {
        campaigns: 3,
        totalAds: 10,
        pause: 1,
        scale: 0,
        aiAvailable: true,
      });

      await expect(service.judgeRun(TENANT_ID, runId as string)).resolves.toBeUndefined();
      expect(client.rows("judge_results")).toHaveLength(1);
    });
  });
});
