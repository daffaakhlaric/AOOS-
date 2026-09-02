import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import { JudgeResultRepository, JudgeResultRepositoryError } from "./judge-result.repository.js";

const TENANT_ID = "dss-motor";

function seedJudgeResult(
  client: ReturnType<typeof createFakeSupabaseClient>,
  overrides: {
    readonly id: string;
    readonly tenant_id?: string;
    readonly agent?: string;
    readonly created_at: string;
    readonly overall?: number | undefined;
  },
): void {
  client.seed("judge_results", {
    id: overrides.id,
    tenant_id: overrides.tenant_id ?? TENANT_ID,
    agent: overrides.agent ?? "SAMANTHA",
    run_id: `run-${overrides.id}`,
    scores: overrides.overall === undefined ? {} : { overall: overrides.overall },
    strengths: [],
    gaps: [],
    notes: null,
    created_at: overrides.created_at,
  });
}

describe("JudgeResultRepository.getTodayScoreSummary", () => {
  const NOW = new Date("2026-01-15T12:00:00.000Z"); // today = 2026-01-15 UTC

  it("returns undefined averages/delta and 0 sample sizes when there are zero real rows in either window", async () => {
    const client = createFakeSupabaseClient();
    const repo = new JudgeResultRepository(client);
    const summary = await repo.getTodayScoreSummary(TENANT_ID, "SAMANTHA", NOW);
    expect(summary).toEqual({
      agent: "SAMANTHA",
      todayAverageOverall: undefined,
      priorSevenDayAverageOverall: undefined,
      delta: undefined,
      todaySampleSize: 0,
      priorSevenDaySampleSize: 0,
    });
  });

  it("computes a real, correct today average from today's rows only, excluding rows from the prior-7-day window and other tenants/agents", async () => {
    const client = createFakeSupabaseClient();
    // 2 real rows today for SAMANTHA/dss-motor — average should be (80+90)/2 = 85.
    seedJudgeResult(client, { id: "today-1", created_at: "2026-01-15T01:00:00.000Z", overall: 80 });
    seedJudgeResult(client, { id: "today-2", created_at: "2026-01-15T10:00:00.000Z", overall: 90 });
    // A row from yesterday (still within the prior-7-day window, NOT today).
    seedJudgeResult(client, { id: "prior-1", created_at: "2026-01-14T08:00:00.000Z", overall: 60 });
    // A row for a different agent — must not be counted.
    seedJudgeResult(client, {
      id: "other-agent",
      agent: "CLARA",
      created_at: "2026-01-15T02:00:00.000Z",
      overall: 10,
    });
    // A row for a different tenant — must not be counted.
    seedJudgeResult(client, {
      id: "other-tenant",
      tenant_id: "other-tenant",
      created_at: "2026-01-15T02:00:00.000Z",
      overall: 10,
    });
    // A row from more than 7 days before today — outside the prior window entirely.
    seedJudgeResult(client, { id: "too-old", created_at: "2026-01-01T00:00:00.000Z", overall: 5 });

    const repo = new JudgeResultRepository(client);
    const summary = await repo.getTodayScoreSummary(TENANT_ID, "SAMANTHA", NOW);

    expect(summary.todayAverageOverall).toBe(85);
    expect(summary.todaySampleSize).toBe(2);
    expect(summary.priorSevenDayAverageOverall).toBe(60);
    expect(summary.priorSevenDaySampleSize).toBe(1);
    expect(summary.delta).toBe(25); // 85 - 60
  });

  it("excludes a row with a malformed/missing overall score from both the average and its own sample count, never coercing to 0", async () => {
    const client = createFakeSupabaseClient();
    seedJudgeResult(client, {
      id: "today-good",
      created_at: "2026-01-15T01:00:00.000Z",
      overall: 80,
    });
    seedJudgeResult(client, {
      id: "today-bad",
      created_at: "2026-01-15T02:00:00.000Z",
      overall: undefined,
    });

    const repo = new JudgeResultRepository(client);
    const summary = await repo.getTodayScoreSummary(TENANT_ID, "SAMANTHA", NOW);

    expect(summary.todayAverageOverall).toBe(80);
    expect(summary.todaySampleSize).toBe(1);
  });

  it("leaves delta undefined when only one of the two windows has real data", async () => {
    const client = createFakeSupabaseClient();
    seedJudgeResult(client, {
      id: "today-only",
      created_at: "2026-01-15T01:00:00.000Z",
      overall: 70,
    });

    const repo = new JudgeResultRepository(client);
    const summary = await repo.getTodayScoreSummary(TENANT_ID, "SAMANTHA", NOW);

    expect(summary.todayAverageOverall).toBe(70);
    expect(summary.priorSevenDayAverageOverall).toBeUndefined();
    expect(summary.delta).toBeUndefined();
  });

  it("listForTenantSince throws JudgeResultRepositoryError on a forced Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("judge_results", "boom");
    const repo = new JudgeResultRepository(client);
    await expect(
      repo.listForTenantSince(TENANT_ID, "SAMANTHA", "2026-01-01T00:00:00.000Z"),
    ).rejects.toThrow(JudgeResultRepositoryError);
  });
});
