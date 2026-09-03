import { TokenBucketRateLimiter, type IRateLimiter } from "@aos/meta-ads-connector";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  createFakeSupabaseClient,
  type FakeSupabaseClient,
} from "../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../test-support/fixtures.js";
import { mswServer } from "../../test-support/openai-msw.js";
import { AgentConfigService } from "../agent-config/agent-config.service.js";
import { AgentConfigRepository } from "../agent-config/infrastructure/agent-config.repository.js";
import { AgentRunsService } from "../agent-runs/agent-runs.service.js";
import { AgentRunRepository } from "../agent-runs/infrastructure/agent-run.repository.js";
import { JudgeResultRepository } from "../ai-judge/infrastructure/judge-result.repository.js";
import { JudgeMemoryService } from "../judge-memory/judge-memory.service.js";
import { LearningProposalRepository } from "../learning/infrastructure/learning-proposal.repository.js";
import { ResponseCache } from "../llm/cache/ResponseCache.js";
import type { ImprovementItem } from "../llm/dto/improvement-plan.dto.js";
import {
  OPENAI_BASE_URL,
  CHAT_COMPLETIONS_PATH,
  OpenAiClient,
} from "../llm/infrastructure/OpenAiClient.js";
import { LlmService } from "../llm/llm.service.js";
import { PromptOverrideRepository } from "../prompt-override/infrastructure/prompt-override.repository.js";
import { PromptOverrideService } from "../prompt-override/prompt-override.service.js";

import { SandboxService } from "./sandbox.service.js";

const TENANT_ID = "dss-motor";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const validAnalyzeJson = JSON.stringify({
  temuan: [{ icon: "📈", judul: "Coverage baik", detail: "Semua campaign tercakup." }],
  rekomendasi: [
    { aksi: "SCALE", target: "Campaign A", alasan: "Performa baik", estimasi: "+10% lead" },
  ],
  ringkasan: "Ringkasan analisa nyata.",
});

function samanthaJudgeJson(overall: number): string {
  return JSON.stringify({
    scores: {
      ai_availability: overall,
      coverage: overall,
      verdict_actionability: overall,
      trend_consistency: overall,
      overall,
    },
    strengths: ["Real strength."],
    gaps: [],
    trend: "STABLE",
    notes: "Real notes.",
  });
}

/** Distinguishes an `analyze` OpenAI call from a `judgeAgentRun` call by real system-prompt content (never by call order — real, robust against either call happening first). */
function registerAnalyzeVsJudgeHandler(analyzeContent: string, judgeOverall: number): void {
  mswServer.use(
    http.post(`${OPENAI_BASE_URL}${CHAT_COMPLETIONS_PATH}`, async ({ request }) => {
      const body = (await request.json()) as { messages: { role: string; content: string }[] };
      const systemMessage = body.messages.find((m) => m.role === "system");
      const isJudgeCall = systemMessage?.content.includes("AI Judge untuk Samantha") ?? false;
      const content = isJudgeCall ? samanthaJudgeJson(judgeOverall) : analyzeContent;
      return HttpResponse.json({
        id: "chatcmpl-test",
        object: "chat.completion",
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      });
    }),
  );
}

function buildRealLlmService(apiKey = "test-openai-key"): LlmService {
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

function buildService(
  client: FakeSupabaseClient = createFakeSupabaseClient(),
  llmService: LlmService = buildRealLlmService(),
): {
  readonly client: FakeSupabaseClient;
  readonly agentRuns: AgentRunsService;
  readonly judgeResults: JudgeResultRepository;
  readonly agentConfig: AgentConfigService;
  readonly service: SandboxService;
} {
  const agentRuns = new AgentRunsService(new AgentRunRepository(client));
  const judgeResults = new JudgeResultRepository(client);
  const agentConfig = new AgentConfigService(new AgentConfigRepository(client));
  const judgeMemory = new JudgeMemoryService(judgeResults, new LearningProposalRepository(client));
  return {
    client,
    agentRuns,
    judgeResults,
    agentConfig,
    service: new SandboxService(agentRuns, llmService, agentConfig, judgeResults, judgeMemory),
  };
}

const PROMPT_UPDATE_ITEM: ImprovementItem = {
  agent: "SAMANTHA",
  type: "PROMPT_UPDATE",
  target: "analyze",
  before: "prompt lama",
  after: "Kamu adalah Samantha, versi kandidat baru.",
  reason: "Uji coba real prompt baru.",
  severity: "MEDIUM",
};

/** Seeds a real baseline `agent_runs` row (with the Phase SI-4 `analyzeCampaigns`/`analyzeTotals` capture) plus its already-persisted `judge_results` row — the real, honest "this run was actually judged" precondition `SandboxService.testImprovement` requires. */
async function seedBaseline(
  agentRuns: AgentRunsService,
  judgeResults: JudgeResultRepository,
  overallScore: number,
): Promise<string> {
  const runId = await agentRuns.record(TENANT_ID, "SAMANTHA", "evt-baseline", {
    campaigns: 2,
    totalAds: 5,
    pause: 1,
    scale: 1,
    aiAvailable: true,
    analyzeCampaigns: [
      {
        id: "c1",
        stableId: "c1",
        name: "Campaign A",
        objective: "LEADS",
        status: "ACTIVE",
        spend: 1000,
        adSets: [],
      },
    ],
    analyzeTotals: null,
  });
  if (runId === undefined) {
    throw new Error("test setup failed: agentRuns.record returned undefined");
  }
  await judgeResults.insert({
    tenantId: TENANT_ID,
    agent: "SAMANTHA",
    runId,
    scores: { overall: overallScore },
    strengths: [],
    gaps: [],
    notes: "baseline",
  });
  return runId;
}

describe("SandboxService.testImprovement", () => {
  it("computes a real baseline-vs-sandbox delta and reports improved=true when it clears min_delta_to_apply", async () => {
    const { agentRuns, judgeResults, service } = buildService(
      undefined,
      buildRealLlmService("test-openai-key"),
    );
    registerAnalyzeVsJudgeHandler(validAnalyzeJson, 90);
    const runId = await seedBaseline(agentRuns, judgeResults, 70);

    const result = await service.testImprovement(TENANT_ID, "SAMANTHA", PROMPT_UPDATE_ITEM, runId);

    expect(result.available).toBe(true);
    expect(result.baselineScore).toBe(70);
    expect(result.sandboxScore).toBe(90);
    expect(result.delta).toBe(20);
    expect(result.minDelta).toBe(3);
    expect(result.improved).toBe(true);
  });

  it("reports improved=false when the delta is below min_delta_to_apply", async () => {
    const { agentRuns, judgeResults, service } = buildService(
      undefined,
      buildRealLlmService("test-openai-key"),
    );
    registerAnalyzeVsJudgeHandler(validAnalyzeJson, 71);
    const runId = await seedBaseline(agentRuns, judgeResults, 70);

    const result = await service.testImprovement(TENANT_ID, "SAMANTHA", PROMPT_UPDATE_ITEM, runId);

    expect(result.available).toBe(true);
    expect(result.delta).toBe(1);
    expect(result.improved).toBe(false);
  });

  it("resolves min_delta_to_apply via AgentConfigService (SANDBOX bucket) instead of the hardcoded default", async () => {
    const { client, agentRuns, judgeResults, agentConfig, service } = buildService(
      undefined,
      buildRealLlmService("test-openai-key"),
    );
    await agentConfig.set(TENANT_ID, "SANDBOX", "min_delta_to_apply", 10);
    registerAnalyzeVsJudgeHandler(validAnalyzeJson, 75);
    const runId = await seedBaseline(agentRuns, judgeResults, 70);

    const result = await service.testImprovement(TENANT_ID, "SAMANTHA", PROMPT_UPDATE_ITEM, runId);

    expect(result.minDelta).toBe(10);
    expect(result.delta).toBe(5);
    expect(result.improved).toBe(false);
    void client;
  });

  it("degrades honestly (never fabricates a score) when the baseline agent_runs row is missing", async () => {
    const { service } = buildService(undefined, buildRealLlmService("test-openai-key"));
    const result = await service.testImprovement(
      TENANT_ID,
      "SAMANTHA",
      PROMPT_UPDATE_ITEM,
      "does-not-exist",
    );
    expect(result.available).toBe(false);
    expect(result.improved).toBe(false);
    expect(result.baselineScore).toBeNull();
    expect(result.sandboxScore).toBeNull();
    expect(result.delta).toBeNull();
    expect(result.reason).toContain("not found");
  });

  it("degrades honestly when the baseline agent_runs row's context lacks the real analyzeCampaigns capture (pre-SI-4 rows)", async () => {
    const { agentRuns, service } = buildService(undefined, buildRealLlmService("test-openai-key"));
    const runId = await agentRuns.record(TENANT_ID, "SAMANTHA", "evt-old", {
      campaigns: 2,
      totalAds: 5,
      pause: 1,
      scale: 1,
      aiAvailable: true,
    });
    if (runId === undefined) {
      throw new Error("test setup failed");
    }
    const result = await service.testImprovement(TENANT_ID, "SAMANTHA", PROMPT_UPDATE_ITEM, runId);
    expect(result.available).toBe(false);
    expect(result.reason).toContain("analyzeCampaigns");
  });

  it("degrades honestly when the baseline run was never successfully judged (no judge_results row)", async () => {
    const { agentRuns, service } = buildService(undefined, buildRealLlmService("test-openai-key"));
    const runId = await agentRuns.record(TENANT_ID, "SAMANTHA", "evt-unjudged", {
      campaigns: 1,
      totalAds: 1,
      pause: 0,
      scale: 0,
      aiAvailable: true,
      analyzeCampaigns: [],
      analyzeTotals: null,
    });
    if (runId === undefined) {
      throw new Error("test setup failed");
    }
    const result = await service.testImprovement(TENANT_ID, "SAMANTHA", PROMPT_UPDATE_ITEM, runId);
    expect(result.available).toBe(false);
    expect(result.reason).toContain("judge_results");
  });

  it("degrades honestly (never fabricates coverage) for CONFIG_UPDATE — analyze() doesn't consume agent_configs", async () => {
    const { agentRuns, judgeResults, service } = buildService(
      undefined,
      buildRealLlmService("test-openai-key"),
    );
    const runId = await seedBaseline(agentRuns, judgeResults, 70);
    const configItem: ImprovementItem = {
      agent: "SAMANTHA",
      type: "CONFIG_UPDATE",
      target: "pause_cpl_multiplier",
      before: "1.5",
      after: "2.0",
      reason: "test",
      severity: "LOW",
    };
    const result = await service.testImprovement(TENANT_ID, "SAMANTHA", configItem, runId);
    expect(result.available).toBe(false);
    expect(result.reason).toContain("scoped to SAMANTHA PROMPT_UPDATE");
  });

  it("degrades honestly for LOGIC_UPDATE — analyze() doesn't consume agent_logic either", async () => {
    const { agentRuns, judgeResults, service } = buildService(
      undefined,
      buildRealLlmService("test-openai-key"),
    );
    const runId = await seedBaseline(agentRuns, judgeResults, 70);
    const logicItem: ImprovementItem = {
      agent: "SAMANTHA",
      type: "LOGIC_UPDATE",
      target: "verdict_classification",
      before: "[]",
      after: "[]",
      reason: "test",
      severity: "LOW",
    };
    const result = await service.testImprovement(TENANT_ID, "SAMANTHA", logicItem, runId);
    expect(result.available).toBe(false);
    expect(result.reason).toContain("scoped to SAMANTHA PROMPT_UPDATE");
  });

  // AAOS Self-Improving, Phase SI-5 — `baselineAgentRunId` is now optional (a SIMULATION-triggered
  // gap has no real `agent_runs.id` of its own to pass).
  it("falls back to the tenant+agent's real most-recent agent_runs row when baselineAgentRunId is omitted", async () => {
    const { agentRuns, judgeResults, service } = buildService(
      undefined,
      buildRealLlmService("test-openai-key"),
    );
    registerAnalyzeVsJudgeHandler(validAnalyzeJson, 90);
    const runId = await seedBaseline(agentRuns, judgeResults, 70);

    const result = await service.testImprovement(TENANT_ID, "SAMANTHA", PROMPT_UPDATE_ITEM);

    expect(result.available).toBe(true);
    expect(result.baselineScore).toBe(70);
    void runId;
  });

  it("degrades honestly (never fabricates a baseline) when no real agent_runs row exists yet for the tenant+agent and baselineAgentRunId is omitted", async () => {
    const { service } = buildService(undefined, buildRealLlmService("test-openai-key"));
    const result = await service.testImprovement(TENANT_ID, "SAMANTHA", PROMPT_UPDATE_ITEM);
    expect(result.available).toBe(false);
    expect(result.reason).toContain("no real agent_runs row exists");
  });
});
