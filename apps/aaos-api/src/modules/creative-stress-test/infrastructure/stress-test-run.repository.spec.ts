import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import {
  StressTestRunRepository,
  StressTestRunRepositoryError,
  type CreateStressTestRunInput,
} from "./stress-test-run.repository.js";

const BASE_INPUT: CreateStressTestRunInput = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  tenantId: "dss-motor",
  name: "Test run 1",
  sourceType: "LISTING",
  listingId: "listing-1",
  creativeIds: ["pkg-1"],
  mode: "STANDARD",
  primaryGoal: "CREATIVE_QUALITY",
  personaIds: ["PRICE_SENSITIVE", "HIGH_INTENT"],
  objectionSources: ["LISTING_KNOWLEDGE_BASE", "HISTORICAL_OBJECTIONS"],
};

describe("StressTestRunRepository", () => {
  it("create persists a DRAFT run with a null result (never a fabricated one)", async () => {
    const repo = new StressTestRunRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);

    expect(created.status).toBe("DRAFT");
    expect(created.result).toBeNull();
    expect(created.personaIds).toEqual(["PRICE_SENSITIVE", "HIGH_INTENT"]);
    expect(created.objectionSources).toEqual(["LISTING_KNOWLEDGE_BASE", "HISTORICAL_OBJECTIONS"]);
    expect(created.listingId).toBe("listing-1");
    expect(created.campaignId).toBeUndefined();
  });

  it("findById scopes strictly by tenant — a run from another tenant is never returned", async () => {
    const repo = new StressTestRunRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);

    const found = await repo.findById("dss-motor", created.id);
    expect(found?.id).toBe(created.id);

    const notFound = await repo.findById("other-tenant", created.id);
    expect(notFound).toBeUndefined();
  });

  it("listByTenant returns only that tenant's runs (tenant-scoped)", async () => {
    const repo = new StressTestRunRepository(createFakeSupabaseClient());
    await repo.create({ ...BASE_INPUT, id: "run-1" });
    await repo.create({ ...BASE_INPUT, id: "run-2" });
    await repo.create({ ...BASE_INPUT, id: "run-other", tenantId: "other-tenant" });

    const found = await repo.listByTenant("dss-motor");
    expect(found.map((r) => r.id).sort()).toEqual(["run-1", "run-2"]);
  });

  it("markStatus updates the status column", async () => {
    const repo = new StressTestRunRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);
    await repo.markStatus(created.id, "QUEUED");
    const found = await repo.findById("dss-motor", created.id);
    expect(found?.status).toBe("QUEUED");
  });

  it("markWaitingForEngine persists the real honest result marker, never a fabricated score", async () => {
    const repo = new StressTestRunRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);
    await repo.markWaitingForEngine(
      created.id,
      {
        kind: "WAITING_FOR_ENGINE",
        reason: "no evaluator yet",
        objectionSourceAvailability: [
          { source: "LISTING_KNOWLEDGE_BASE", hasRealData: true, note: "real" },
        ],
      },
      "2026-09-28T00:00:00.000Z",
    );
    const found = await repo.findById("dss-motor", created.id);
    expect(found?.status).toBe("WAITING_FOR_ENGINE");
    expect(found?.result?.kind).toBe("WAITING_FOR_ENGINE");
    expect(found?.completedAt).toBe("2026-09-28T00:00:00.000Z");
  });

  it("markFailed sets a real failed_reason and FAILED status", async () => {
    const repo = new StressTestRunRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);
    await repo.markFailed(created.id, "boom");
    const found = await repo.findById("dss-motor", created.id);
    expect(found?.status).toBe("FAILED");
    expect(found?.failedReason).toBe("boom");
  });

  it("markFailed also persists a real completedAt when given one", async () => {
    const repo = new StressTestRunRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);
    await repo.markFailed(created.id, "boom", "2026-09-28T00:00:00.000Z");
    const found = await repo.findById("dss-motor", created.id);
    expect(found?.completedAt).toBe("2026-09-28T00:00:00.000Z");
  });

  it("markCompleted persists a real evaluated result and COMPLETED status (Second Boundary)", async () => {
    const repo = new StressTestRunRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);
    await repo.markCompleted(
      created.id,
      {
        kind: "COMPLETED",
        personaCritiques: [],
        copyEvaluation: { ok: false, failureReason: "PROVIDER_ERROR" },
        factCheck: { status: "NOT_APPLICABLE", note: "no knowledge", findings: [] },
        dimensionScores: [{ dimension: "HOOK", score: 80 }],
        overallScore: 80,
        scoreBucket: "MINOR_REVISION",
        confidence: 50,
        primaryRecommendation: "Perbaiki CTA.",
        evaluatorsAttempted: 2,
        evaluatorsSucceeded: 1,
        gaps: ["Copy Evaluator gagal."],
      },
      "2026-09-28T00:00:00.000Z",
    );
    const found = await repo.findById("dss-motor", created.id);
    expect(found?.status).toBe("COMPLETED");
    expect(found?.result?.kind).toBe("COMPLETED");
    expect(found?.completedAt).toBe("2026-09-28T00:00:00.000Z");
  });

  it("surfaces a real repository error when the underlying client errors", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("stress_test_runs", "connection reset");
    const repo = new StressTestRunRepository(client);
    await expect(repo.create(BASE_INPUT)).rejects.toBeInstanceOf(StressTestRunRepositoryError);
  });

  const PROGRESS = {
    steps: [
      {
        key: "PERSONA_SIMULATION" as const,
        state: "RUNNING" as const,
        done: 0,
        total: 2,
        failed: 0,
      },
      { key: "COPY_EVALUATION" as const, state: "RUNNING" as const },
      { key: "FACT_VALIDATION" as const, state: "RUNNING" as const },
      { key: "OBJECTION_RESOLUTION" as const, state: "PENDING" as const },
    ],
    updatedAt: "2026-09-28T00:00:00.000Z",
  };

  it("markRunning sets RUNNING and stores progress inside the existing result jsonb (IN_PROGRESS)", async () => {
    const repo = new StressTestRunRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);
    await repo.markRunning(created.id, PROGRESS);
    const found = await repo.findById("dss-motor", created.id);
    expect(found?.status).toBe("RUNNING");
    expect(found?.result).toEqual({ kind: "IN_PROGRESS", progress: PROGRESS });
  });

  it("updateProgress only writes while the row is still RUNNING", async () => {
    const repo = new StressTestRunRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);
    await repo.markRunning(created.id, PROGRESS);
    const next = {
      ...PROGRESS,
      steps: PROGRESS.steps.map((s) => ({ ...s, state: "DONE" as const })),
    };
    await repo.updateProgress(created.id, next);
    expect((await repo.findById("dss-motor", created.id))?.result).toEqual({
      kind: "IN_PROGRESS",
      progress: next,
    });

    await repo.markStatus(created.id, "CANCELLED");
    await repo.updateProgress(created.id, PROGRESS);
    expect((await repo.findById("dss-motor", created.id))?.result).toEqual({
      kind: "IN_PROGRESS",
      progress: next,
    });
  });

  it("markFailed persists a partial result when given one (partial: true, no score)", async () => {
    const repo = new StressTestRunRepository(createFakeSupabaseClient());
    const created = await repo.create(BASE_INPUT);
    await repo.markFailed(created.id, "boom", "2026-09-28T00:00:00.000Z", {
      kind: "PARTIAL",
      partial: true,
      hasRealOutput: false,
      personaCritiques: [],
      evaluatorsAttempted: 0,
      evaluatorsSucceeded: 0,
      gaps: ["boom"],
      progress: PROGRESS,
    });
    const found = await repo.findById("dss-motor", created.id);
    expect(found?.status).toBe("FAILED");
    expect(found?.result?.kind).toBe("PARTIAL");
  });
});
