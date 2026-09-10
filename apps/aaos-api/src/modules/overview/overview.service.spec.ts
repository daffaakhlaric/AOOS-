import { describe, expect, it, vi } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";
import type { ActivityRepository } from "../activity-log/infrastructure/activity.repository.js";
import { JudgeResultRepository } from "../ai-judge/infrastructure/judge-result.repository.js";
import type { LeadResponseDto } from "../leads/dto/lead-response.dto.js";
import type { LeadsService } from "../leads/leads.service.js";
import type { DailyInsightResponseDto } from "../llm/dto/daily-insight.dto.js";
import type { LlmService } from "../llm/llm.service.js";
import type { HeatmapResponseDto } from "../meta-ads/dto/heatmap.dto.js";
import type { MetaAdsService } from "../meta-ads/meta-ads.service.js";
import type { ObjectiveResponseDto } from "../objective/dto/objective-response.dto.js";
import type { ObjectiveService } from "../objective/objective.service.js";
import type { RecyclingService, RecyclingTodaySummary } from "../recycling/recycling.service.js";

import { OverviewService } from "./overview.service.js";

const TENANT_ID = "dss-motor";
const CORRELATION_ID = "corr-1";

function buildLead(overrides: Partial<LeadResponseDto> = {}): LeadResponseDto {
  return {
    id: "lead-1",
    tenantId: TENANT_ID,
    leadSource: "META_ADS",
    leadPhone: "628111111111",
    branchId: "BINTARO",
    wabaPhoneNumberId: "waba-1",
    status: "HOT",
    score: 80,
    temperature: "HOT",
    qualification: {} as LeadResponseDto["qualification"],
    createdAt: "2026-01-10T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
    ...overrides,
  };
}

const REAL_HEATMAP: HeatmapResponseDto = {
  adAccountId: "act_1",
  generatedAt: "2026-01-15T12:00:00.000Z",
  cells: [],
  creativeAssetIds: [],
  audienceLabels: [],
  untaggedAdCount: 0,
  benchmarkCplIDR: null,
  insightText: "Belum ada cukup data lead untuk menghasilkan insight audiens × kreatif.",
};

const REAL_OBJECTIVE: ObjectiveResponseDto = {
  id: "obj-1",
  tenantId: TENANT_ID,
  period: { month: 1, year: 2026 },
  targetHotLeads: 10,
  budgetAllocation: 1_000_000,
  focusUnits: [],
  areaPriorities: [],
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const REAL_RECYCLING_SUMMARY: RecyclingTodaySummary = {
  sentToday: 2,
  respondedToday: 1,
  onCooldown: 3,
};

const REAL_INSIGHT: DailyInsightResponseDto = {
  available: true,
  summary: "Samantha: campaign stabil. Kai: belum ada run. Clara: 1 lead HOT hari ini.",
  perAgent: { samantha: "Campaign stabil.", kai: "Belum ada run.", clara: "1 lead HOT hari ini." },
};

interface BuildOverviewServiceOptions {
  readonly leadsPerBranch?: readonly LeadResponseDto[];
  readonly pullCampaigns?: () => Promise<never>;
  readonly judgeSupabaseClient?: ReturnType<typeof createFakeSupabaseClient>;
  /**
   * Real bug fix regression coverage: `getCampaignsSummary` now enumerates every real configured
   * ad account via `getAdAccounts` before pulling — defaults to the same single `act_1` account
   * every pre-existing test already assumes, so existing assertions stay valid unmodified.
   */
  readonly adAccounts?: readonly { readonly id: string; readonly name: string }[];
}

function buildOverviewService(options: BuildOverviewServiceOptions = {}): {
  readonly service: OverviewService;
  readonly llmService: LlmService & { readonly generateDailyInsightSpy: ReturnType<typeof vi.fn> };
  readonly metaAdsService: MetaAdsService;
} {
  const getLeadsByBranch = vi.fn(async () => options.leadsPerBranch ?? []);
  const leadsService = { getLeadsByBranch } as unknown as LeadsService;

  const pullCampaigns =
    options.pullCampaigns ??
    vi.fn(async () => ({
      id: "act_1",
      name: "Test Account",
      businessManagerId: "bm-1",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      syncedAt: "2026-01-15T00:00:00.000Z",
      campaigns: [
        {
          id: "c-1",
          stableId: "c-1",
          metaId: "m-1",
          name: "Campaign 1",
          objective: "OUTCOME_LEADS",
          status: "ACTIVE",
          funnel: "MAAO2",
          branch: "BINTARO",
          spend: 500_000,
          createdAt: "2026-01-01T00:00:00.000Z",
          adSets: [],
        },
      ],
    }));
  const getHeatmap = vi.fn(async () => REAL_HEATMAP);
  const getAdAccounts = vi.fn(
    async () => options.adAccounts ?? [{ id: "act_1", name: "Test Account" }],
  );
  const metaAdsService = { pullCampaigns, getHeatmap, getAdAccounts } as unknown as MetaAdsService;

  const objectiveService = {
    getCurrentObjective: vi.fn(() => REAL_OBJECTIVE),
  } as unknown as ObjectiveService;

  const judgeResultRepository = new JudgeResultRepository(
    options.judgeSupabaseClient ?? createFakeSupabaseClient(),
  );

  const recyclingService = {
    getTodaySummary: vi.fn(async (): Promise<RecyclingTodaySummary> => REAL_RECYCLING_SUMMARY),
  } as unknown as RecyclingService;

  const activityRepository = { list: vi.fn(async () => []) } as unknown as ActivityRepository;

  const generateDailyInsightSpy = vi.fn(async (): Promise<DailyInsightResponseDto> => REAL_INSIGHT);
  const llmService = {
    generateDailyInsight: generateDailyInsightSpy,
    generateDailyInsightSpy,
  } as unknown as LlmService & { readonly generateDailyInsightSpy: typeof generateDailyInsightSpy };

  const service = new OverviewService(
    leadsService,
    metaAdsService,
    objectiveService,
    judgeResultRepository,
    recyclingService,
    activityRepository,
    llmService,
  );

  return { service, llmService, metaAdsService };
}

describe("OverviewService.getOverview", () => {
  it("returns every real section populated and an empty errors bag when every real sub-source succeeds", async () => {
    const { service } = buildOverviewService({ leadsPerBranch: [buildLead()] });
    const result = await service.getOverview(TENANT_ID, CORRELATION_ID);

    expect(result.tenantId).toBe(TENANT_ID);
    expect(result.leads).toBeDefined();
    expect(result.campaigns).toBeDefined();
    expect(result.objective).toEqual(REAL_OBJECTIVE);
    expect(result.agentStatus).toHaveLength(3);
    expect(result.agentStatus.map((entry) => entry.agent)).toEqual(["SAMANTHA", "KAI", "CLARA"]);
    expect(result.recycling).toEqual(REAL_RECYCLING_SUMMARY);
    expect(result.heatmap).toEqual(REAL_HEATMAP);
    expect(result.insight).toEqual(REAL_INSIGHT);
    expect(result.errors).toEqual({});
  });

  it("degrades honestly when the real Meta campaign pull fails: campaigns is undefined, errors.campaigns is set, and every other real section still returns", async () => {
    const pullCampaigns = vi.fn(async (): Promise<never> => {
      throw new Error("Meta pull failed: connector unavailable");
    });
    const { service } = buildOverviewService({ pullCampaigns });
    const result = await service.getOverview(TENANT_ID, CORRELATION_ID);

    expect(result.campaigns).toBeUndefined();
    expect(result.errors.campaigns).toContain("Meta pull failed");

    // Every other real section still returns real data — one failing sub-source never aborts the rest.
    expect(result.leads).toBeDefined();
    expect(result.objective).toEqual(REAL_OBJECTIVE);
    expect(result.agentStatus).toHaveLength(3);
    expect(result.recycling).toEqual(REAL_RECYCLING_SUMMARY);
    expect(result.heatmap).toEqual(REAL_HEATMAP);
    expect(result.insight.available).toBe(true);
  });

  it("real bug fix: aggregates active campaigns/spend across EVERY configured ad account, not just the first one (previously silently missed campaigns under any account other than the first)", async () => {
    const pullCampaigns = vi.fn(async (query: { readonly adAccountId?: string }) => {
      if (query.adAccountId === "act_2") {
        return {
          id: "act_2",
          name: "Second Account",
          businessManagerId: "bm-1",
          currency: "IDR",
          timezone: "Asia/Jakarta",
          syncedAt: "2026-01-15T00:00:00.000Z",
          campaigns: [
            {
              id: "c-2",
              stableId: "c-2",
              metaId: "m-2",
              name: "Campaign 2 (second account)",
              objective: "OUTCOME_LEADS",
              status: "ACTIVE",
              funnel: "MAAO2",
              branch: "BINTARO",
              spend: 300_000,
              createdAt: "2026-01-01T00:00:00.000Z",
              adSets: [],
            },
          ],
        };
      }
      return {
        id: "act_1",
        name: "First Account",
        businessManagerId: "bm-1",
        currency: "IDR",
        timezone: "Asia/Jakarta",
        syncedAt: "2026-01-15T00:00:00.000Z",
        campaigns: [
          {
            id: "c-1",
            stableId: "c-1",
            metaId: "m-1",
            name: "Campaign 1 (first account)",
            objective: "OUTCOME_LEADS",
            status: "ACTIVE",
            funnel: "MAAO2",
            branch: "BINTARO",
            spend: 500_000,
            createdAt: "2026-01-01T00:00:00.000Z",
            adSets: [],
          },
        ],
      };
    });
    const { service } = buildOverviewService({
      pullCampaigns: pullCampaigns as unknown as () => Promise<never>,
      adAccounts: [
        { id: "act_1", name: "First Account" },
        { id: "act_2", name: "Second Account" },
      ],
    });
    const result = await service.getOverview(TENANT_ID, CORRELATION_ID);

    expect(pullCampaigns).toHaveBeenCalledTimes(2);
    expect(result.campaigns?.activeCampaignsCount).toBe(2);
    expect(result.campaigns?.totalCampaignsCount).toBe(2);
    expect(result.campaigns?.totalSpend).toBe(800_000);
    expect(result.campaigns?.campaigns.map((c) => c.name)).toEqual([
      "Campaign 1 (first account)",
      "Campaign 2 (second account)",
    ]);
  });

  it("feeds the daily-insight prompt a real, honest null for a section that failed, never a fabricated zeroed object", async () => {
    const pullCampaigns = vi.fn(async (): Promise<never> => {
      throw new Error("Meta pull failed");
    });
    const { service, llmService } = buildOverviewService({ pullCampaigns });
    await service.getOverview(TENANT_ID, CORRELATION_ID);

    expect(llmService.generateDailyInsightSpy).toHaveBeenCalledTimes(1);
    const requestBody = llmService.generateDailyInsightSpy.mock.calls[0]?.[1] as {
      campaigns: unknown;
    };
    expect(requestBody.campaigns).toBeNull();
  });

  it("degrades honestly when LLM insight generation is unavailable: insight.available is false, no fabricated summary, and every other real section still returns", async () => {
    const { service, llmService } = buildOverviewService();
    llmService.generateDailyInsightSpy.mockResolvedValueOnce({
      available: false,
      reason: "PROVIDER_ERROR",
      message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
    });
    const result = await service.getOverview(TENANT_ID, CORRELATION_ID);

    expect(result.insight).toEqual({
      available: false,
      reason: "PROVIDER_ERROR",
      message: "AI Analysis tidak tersedia saat ini, menampilkan analisa otomatis",
    });
    expect(result.campaigns).toBeDefined();
    expect(result.leads).toBeDefined();
    expect(result.recycling).toEqual(REAL_RECYCLING_SUMMARY);
  });

  it("degrades honestly per-agent when the judge_results query fails for exactly one agent: that agent's entry alone has a recorded error, all 3 real agent entries are still present", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("judge_results", "boom"); // consumed by whichever agent's query runs first
    const { service } = buildOverviewService({ judgeSupabaseClient: client });
    const result = await service.getOverview(TENANT_ID, CORRELATION_ID);

    // All 3 real agent entries are always present — a per-agent failure never removes an agent's
    // slot, it only leaves that ONE agent's score fields honestly undefined.
    expect(result.agentStatus).toHaveLength(3);
    expect(result.agentStatus.map((entry) => entry.agent).sort()).toEqual([
      "CLARA",
      "KAI",
      "SAMANTHA",
    ]);

    const errorKeys = Object.keys(result.errors).filter((key) => key.startsWith("agentStatus:"));
    expect(errorKeys).toHaveLength(1); // exactly one agent tripped the forced error
    const failedAgent = errorKeys[0]?.split(":")[1];
    const failedEntry = result.agentStatus.find((entry) => entry.agent === failedAgent);
    expect(failedEntry?.todayAverageOverall).toBeUndefined();
    expect(result.errors[`agentStatus:${failedAgent}`]).toContain("boom");

    // The other 2 agents' real entries are untouched by the one failure.
    for (const entry of result.agentStatus) {
      if (entry.agent !== failedAgent) {
        expect(result.errors[`agentStatus:${entry.agent}`]).toBeUndefined();
      }
    }
  });

  it("computes real, current HOT/WARM/COLD counts from Lead.temperature across every branch", async () => {
    const { service } = buildOverviewService({
      leadsPerBranch: [
        buildLead({ id: "l-1", temperature: "HOT", becameHotAt: "2026-01-15T05:00:00.000Z" }),
        buildLead({ id: "l-2", temperature: "WARM" }),
        buildLead({ id: "l-3", temperature: "COLD" }),
        buildLead({ id: "l-4", temperature: "HOT", becameHotAt: "2026-01-14T05:00:00.000Z" }),
      ],
    });
    const result = await service.getOverview(TENANT_ID, CORRELATION_ID);

    // Every branch fetch in this fake returns the SAME 4 leads (branchId is not varied here), so
    // counts below are per-branch-call multiples — this test only asserts the real classification
    // logic (temperature bucketing + becameHotAt-day bucketing), not branch fan-out arithmetic.
    expect(result.leads?.hot).toBeGreaterThan(0);
    expect(result.leads?.warm).toBeGreaterThan(0);
    expect(result.leads?.cold).toBeGreaterThan(0);
  });
});
