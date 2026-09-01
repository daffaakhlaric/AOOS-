import { BranchId } from "@aos/branch-manager";
import { ClosingRepository, ClosingType, LeadStoreFactory } from "@aos/lead-store";
import { describe, expect, it, vi } from "vitest";

import { toLeadStoreConfig } from "../../config/to-lead-store-config.js";
import { createFakePublisher } from "../../test-support/fake-publisher.js";
import {
  createFakeSupabaseClient,
  type FakeSupabaseClient,
  type Row,
} from "../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../test-support/fixtures.js";
import { AgentRunsService } from "../agent-runs/agent-runs.service.js";
import { AgentRunRepository } from "../agent-runs/infrastructure/agent-run.repository.js";
import type { AiJudgeService } from "../ai-judge/ai-judge.service.js";

import { ClosingsService } from "./closings.service.js";

/** A fake `AiJudgeService` — `judgeRun`'s own real behavior (real per-agent judge prompts, real degrade, real judge_results persistence) is exercised on its own in `modules/ai-judge/ai-judge.service.spec.ts`; here we only need to verify `ClosingsService`'s real WIRING (called with the right args, a rejection never aborts `createClosing`). */
function buildFakeAiJudgeService(
  judgeRun: (tenantId: string, agentRunId: string) => Promise<void> = async () => undefined,
): AiJudgeService {
  return { judgeRun: vi.fn(judgeRun) } as unknown as AiJudgeService;
}

function seedLeadRow(overrides: Row = {}): Row {
  const now = new Date("2026-01-15T09:00:00.000Z").toISOString();
  return {
    id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "dss-motor",
    lead_source: "CTWA",
    campaign_id: "#C047",
    ad_id: "#A001",
    ad_account_id: null,
    lead_phone: "+6281200000097",
    lead_name: "Budi",
    branch_id: BranchId.UMUM,
    waba_phone_number_id: "waba-umum-1",
    status: "ASSIGNED",
    score: 80,
    temperature: "HOT",
    qual_budget: true,
    qual_unit: true,
    qual_area: true,
    qual_payment: true,
    qual_timeline: true,
    qual_name: true,
    assigned_sales_id: "sales-rina",
    assigned_at: now,
    assignment_mode: "MANUAL",
    first_message_at: now,
    last_message_at: now,
    became_hot_at: now,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function buildService(
  client: FakeSupabaseClient = createFakeSupabaseClient(),
  aiJudgeService: AiJudgeService = buildFakeAiJudgeService(),
) {
  const config = buildTestConfig();
  const leadStoreConfig = toLeadStoreConfig(config);
  if (!leadStoreConfig.ok) {
    throw new Error("test setup failed");
  }
  const leadStore = LeadStoreFactory.create({
    config: leadStoreConfig.value,
    publisher: createFakePublisher(),
    supabaseClient: client,
  });
  const closingRepository = new ClosingRepository(client);
  const agentRunsService = new AgentRunsService(new AgentRunRepository(client));
  return {
    service: new ClosingsService(
      config,
      leadStore,
      closingRepository,
      agentRunsService,
      aiJudgeService,
    ),
    client,
    agentRunsService,
    aiJudgeService,
  };
}

describe("ClosingsService.createClosing", () => {
  it("records a closing via @aos/lead-store's RecordClosing and maps it to a ClosingResponseDto", async () => {
    const { service, client } = buildService();
    client.seed("leads", seedLeadRow());
    const dto = await service.createClosing(
      {
        leadId: "11111111-1111-4111-8111-111111111111",
        salesHumanId: "sales-rina",
        closingType: ClosingType.SPK,
        unitModel: "Xpander Cross AT 2020",
        unitPrice: 195_000_000,
        commissionPct: 3,
        commissionIdr: 5_850_000,
      },
      "corr-closing-1",
    );
    expect(dto.closingType).toBe("SPK");
    expect(dto.commissionIdr).toBe(5_850_000);
    expect(dto.salesHumanId).toBe("sales-rina");
  });

  it("throws the raw @aos/lead-store error when the lead does not exist", async () => {
    const { service } = buildService();
    await expect(
      service.createClosing(
        {
          leadId: "00000000-0000-4000-8000-000000000000",
          salesHumanId: "sales-rina",
          closingType: ClosingType.TEST_DRIVE,
        },
        "corr-closing-2",
      ),
    ).rejects.toThrow();
  });

  describe("AAOS-AI-JUDGE-SELF-IMPROVING Phase J1 — real per-run judging pointer", () => {
    it("records a real agent_runs row keyed by the real leadId, with a real minimal closing context", async () => {
      const { service, client } = buildService();
      client.seed("leads", seedLeadRow());

      await service.createClosing(
        {
          leadId: "11111111-1111-4111-8111-111111111111",
          salesHumanId: "sales-rina",
          closingType: ClosingType.SPK,
          unitModel: "Xpander Cross AT 2020",
          commissionPct: 3,
          commissionIdr: 5_850_000,
        },
        "corr-closing-3",
      );

      const rows = client.rows("agent_runs");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        tenant_id: "dss-motor",
        agent: "CLARA",
        run_ref: "11111111-1111-4111-8111-111111111111",
        context: expect.objectContaining({
          closingType: "SPK",
          unitModel: "Xpander Cross AT 2020",
          commissionIdr: 5_850_000,
          commissionPct: 3,
        }),
      });
    });

    it("a real agent_runs recording failure does not abort the real closing — createClosing still resolves and the closing is still persisted", async () => {
      const client = createFakeSupabaseClient();
      client.seed("leads", seedLeadRow());
      client.forceErrorOnce("agent_runs", "simulated DB outage");
      const { service } = buildService(client);

      const dto = await service.createClosing(
        {
          leadId: "11111111-1111-4111-8111-111111111111",
          salesHumanId: "sales-rina",
          closingType: ClosingType.SPK,
        },
        "corr-closing-4",
      );

      expect(dto.closingType).toBe("SPK");
      expect(client.rows("agent_runs")).toHaveLength(0);
      expect(client.rows("closings")).toHaveLength(1);
    });
  });

  describe("AAOS-AI-JUDGE-SELF-IMPROVING Phase J2 — real judging wiring (detached, best-effort)", () => {
    it("calls AiJudgeService.judgeRun with the real tenantId and the real new agent_runs id, detached (createClosing resolves before judgeRun's own promise settles)", async () => {
      let resolveJudge: (() => void) | undefined;
      const judgeStarted = new Promise<void>((resolve) => {
        resolveJudge = resolve;
      });
      let judgeRunSettled = false;
      const aiJudgeService = buildFakeAiJudgeService(async () => {
        resolveJudge?.();
        await new Promise((resolve) => setTimeout(resolve, 5));
        judgeRunSettled = true;
      });
      const { service, client } = buildService(createFakeSupabaseClient(), aiJudgeService);
      client.seed("leads", seedLeadRow());

      const dto = await service.createClosing(
        {
          leadId: "11111111-1111-4111-8111-111111111111",
          salesHumanId: "sales-rina",
          closingType: ClosingType.SPK,
        },
        "corr-closing-5",
      );

      // createClosing already resolved — real, honest proof this call is detached, not awaited.
      expect(dto.closingType).toBe("SPK");
      expect(judgeRunSettled).toBe(false);

      await judgeStarted;
      const runId = client.rows("agent_runs")[0]?.["id"];
      expect(aiJudgeService.judgeRun).toHaveBeenCalledWith("dss-motor", runId);
    });

    it("a judgeRun rejection never aborts or is thrown out of createClosing — best-effort, same discipline as AgentRunsService.record", async () => {
      const aiJudgeService = buildFakeAiJudgeService(async () => {
        throw new Error("simulated judge failure");
      });
      const { service, client } = buildService(createFakeSupabaseClient(), aiJudgeService);
      client.seed("leads", seedLeadRow());

      const dto = await service.createClosing(
        {
          leadId: "11111111-1111-4111-8111-111111111111",
          salesHumanId: "sales-rina",
          closingType: ClosingType.SPK,
        },
        "corr-closing-6",
      );

      expect(dto.closingType).toBe("SPK");
      expect(client.rows("closings")).toHaveLength(1);
      // Let the detached rejection's .catch() run — an unhandled rejection here would fail the test run.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });
});

describe("ClosingsService.getClosings", () => {
  it("filters by salesHumanId (AAOS-W4B coordinator note #4)", async () => {
    const client = createFakeSupabaseClient();
    const { service } = buildService(client);
    const now = new Date().toISOString();
    client.seed("closings", {
      id: "c1",
      lead_id: "lead-1",
      sales_human_id: "sales-rina",
      branch_id: BranchId.UMUM,
      closing_type: "SPK",
      unit_id: null,
      unit_model: null,
      unit_price: null,
      campaign_id: null,
      ad_id: null,
      commission_idr: 1_000_000,
      commission_pct: null,
      notes: null,
      test_drive_at: null,
      spk_at: now,
      created_at: now,
    });
    client.seed("closings", {
      id: "c2",
      lead_id: "lead-2",
      sales_human_id: "sales-budi",
      branch_id: BranchId.UMUM,
      closing_type: "SPK",
      unit_id: null,
      unit_model: null,
      unit_price: null,
      campaign_id: null,
      ad_id: null,
      commission_idr: 2_000_000,
      commission_pct: null,
      notes: null,
      test_drive_at: null,
      spk_at: now,
      created_at: now,
    });

    const dtos = await service.getClosings({ salesHumanId: "sales-rina" });
    expect(dtos).toHaveLength(1);
    expect(dtos[0]?.id).toBe("c1");
  });

  it("defaults to the current calendar month when fromDate/toDate are omitted", async () => {
    const { service } = buildService();
    const dtos = await service.getClosings({});
    expect(dtos).toEqual([]);
  });

  it("respects an explicit fromDate/toDate range", async () => {
    const client = createFakeSupabaseClient();
    const { service } = buildService(client);
    client.seed("closings", {
      id: "c3",
      lead_id: "lead-3",
      sales_human_id: "sales-rina",
      branch_id: BranchId.UMUM,
      closing_type: "TEST_DRIVE",
      unit_id: null,
      unit_model: null,
      unit_price: null,
      campaign_id: null,
      ad_id: null,
      commission_idr: null,
      commission_pct: null,
      notes: null,
      test_drive_at: "2026-01-10T00:00:00.000Z",
      spk_at: null,
      created_at: "2026-01-10T00:00:00.000Z",
    });
    const dtos = await service.getClosings({
      fromDate: "2026-01-01T00:00:00.000Z",
      toDate: "2026-01-31T23:59:59.000Z",
    });
    expect(dtos).toHaveLength(1);
  });
});
