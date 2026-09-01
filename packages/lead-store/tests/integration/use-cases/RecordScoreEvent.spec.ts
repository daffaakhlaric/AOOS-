import { describe, expect, it } from "vitest";

import { RecordScoreEvent } from "../../../src/application/use-cases/RecordScoreEvent.js";
import { LeadStoreEvents } from "../../../src/domain/events/LeadStoreEvents.js";
import { ScoreReason } from "../../../src/domain/value-objects/ScoreReason.js";
import { LeadRepository } from "../../../src/infrastructure/supabase/LeadRepository.js";
import { ScoringRepository } from "../../../src/infrastructure/supabase/ScoringRepository.js";
import { makeLeadRow } from "../../fixtures/leadStoreFixtures.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

function setup(overrides: Partial<ReturnType<typeof makeLeadRow>> = {}) {
  const client = createFakeSupabaseClient();
  const row = makeLeadRow({
    score: 0,
    status: "NEW",
    temperature: "COLD",
    tenant_id: "t1",
    ...overrides,
  });
  client.seed("leads", [row]);
  const leadRepository = new LeadRepository(client);
  const scoringRepository = new ScoringRepository(client);
  const publisher = createFakePublisher();
  const events = new LeadStoreEvents(publisher);
  const useCase = new RecordScoreEvent(leadRepository, scoringRepository, events, () => new Date());
  return { client, useCase, row, publisher };
}

function input(
  leadId: string,
  scoreBefore: number,
  scoreAfter: number,
  delta: number,
  reason: ScoreReason,
) {
  return { leadId, scoreBefore, scoreAfter, delta, reason, tenantId: "t1", correlationId: "c1" };
}

describe("RecordScoreEvent — score progression (pinned exact values)", () => {
  it("start=0 + BUDGET(25) -> score 25 (exact)", async () => {
    const { useCase, row } = setup();
    const event = unwrap(await useCase.execute(input(row.id, 0, 25, 25, ScoreReason.BUDGET)));
    expect(event.scoreAfter).toBe(25);
  });

  it("25 + UNIT -> score 50 (exact)", async () => {
    const { useCase, row } = setup({ score: 25 });
    const event = unwrap(await useCase.execute(input(row.id, 25, 50, 25, ScoreReason.UNIT)));
    expect(event.scoreAfter).toBe(50);
  });

  it("50 + AREA + PAYMENT -> score 100, clamped", async () => {
    const { useCase, row } = setup({ score: 50 });
    let event = unwrap(await useCase.execute(input(row.id, 50, 75, 25, ScoreReason.AREA)));
    expect(event.scoreAfter).toBe(75);
    event = unwrap(await useCase.execute(input(row.id, 75, 100, 25, ScoreReason.PAYMENT)));
    expect(event.scoreAfter).toBe(100);
  });

  it("100 -> HOT -> LeadBecameHot event emitted", async () => {
    const { useCase, row, publisher } = setup({ score: 75, status: "WARM", temperature: "WARM" });
    await useCase.execute(input(row.id, 75, 100, 25, ScoreReason.PAYMENT));
    const hotEvent = publisher.published.find((p) => p.type === "aaos.lead-store.lead.became-hot");
    expect(hotEvent).toBeDefined();
    expect(hotEvent?.payload).toMatchObject({ score: 100 });
  });

  it("100 + NOT_SERIOUS(-20) -> 80 (not below 0, per clamp)", async () => {
    const { useCase, row } = setup({ score: 100, status: "HOT", temperature: "HOT" });
    const event = unwrap(
      await useCase.execute(input(row.id, 100, 80, -20, ScoreReason.NOT_SERIOUS)),
    );
    expect(event.scoreAfter).toBe(80);
  });

  it("clamps a scoreAfter below 0 to exactly 0", async () => {
    const { useCase, row } = setup({ score: 10 });
    const event = unwrap(await useCase.execute(input(row.id, 10, -30, -40, ScoreReason.NO_REPLY)));
    expect(event.scoreAfter).toBe(0);
  });

  it("clamps a scoreAfter above 100 to exactly 100", async () => {
    const { useCase, row } = setup({ score: 90 });
    const event = unwrap(await useCase.execute(input(row.id, 90, 150, 60, ScoreReason.BUDGET)));
    expect(event.scoreAfter).toBe(100);
  });
});

describe("RecordScoreEvent — hot threshold boundary (pinned)", () => {
  it("score=64 -> status=WARM, becameHotAt stays null", async () => {
    const { useCase, client, row } = setup({ score: 30, status: "WARM", temperature: "WARM" });
    await useCase.execute(input(row.id, 30, 64, 34, ScoreReason.UNIT));
    const stored = client.rows("leads")[0];
    expect(stored?.status).toBe("WARM");
    expect(stored?.became_hot_at).toBeNull();
  });

  it("score=65 -> status=HOT, becameHotAt=NOW", async () => {
    const { useCase, client, row } = setup({ score: 30, status: "WARM", temperature: "WARM" });
    await useCase.execute(input(row.id, 30, 65, 35, ScoreReason.UNIT));
    const stored = client.rows("leads")[0];
    expect(stored?.status).toBe("HOT");
    expect(stored?.became_hot_at).not.toBeNull();
  });
});

describe("RecordScoreEvent — design resolution #2 (status regression guard)", () => {
  it("does not revert status when lead is already ASSIGNED", async () => {
    const { useCase, client, row } = setup({ score: 70, status: "ASSIGNED", temperature: "HOT" });
    await useCase.execute(input(row.id, 70, 20, -50, ScoreReason.NOT_SERIOUS));
    const stored = client.rows("leads")[0];
    expect(stored?.status).toBe("ASSIGNED"); // unchanged
    expect(stored?.temperature).toBe("COLD"); // temperature still updates
  });

  it("does not revert status when lead is already CLOSED", async () => {
    const { useCase, client, row } = setup({ score: 70, status: "CLOSED", temperature: "HOT" });
    await useCase.execute(input(row.id, 70, 20, -50, ScoreReason.NOT_SERIOUS));
    const stored = client.rows("leads")[0];
    expect(stored?.status).toBe("CLOSED");
  });

  it("does NOT emit LeadBecameHot for an ASSIGNED lead crossing the threshold again", async () => {
    const { useCase, row, publisher } = setup({
      score: 40,
      status: "ASSIGNED",
      temperature: "WARM",
    });
    await useCase.execute(input(row.id, 40, 90, 50, ScoreReason.BUDGET));
    expect(publisher.published.some((p) => p.type === "aaos.lead-store.lead.became-hot")).toBe(
      false,
    );
  });

  it("does not fire LeadBecameHot twice for a lead already hot", async () => {
    const { useCase, row, publisher } = setup({
      score: 70,
      status: "HOT",
      temperature: "HOT",
      became_hot_at: "2026-01-15T08:00:00.000Z",
    });
    await useCase.execute(input(row.id, 70, 90, 20, ScoreReason.BUDGET));
    expect(publisher.published.some((p) => p.type === "aaos.lead-store.lead.became-hot")).toBe(
      false,
    );
  });
});

describe("RecordScoreEvent — errors", () => {
  it("returns LeadNotFoundError for an unknown lead", async () => {
    const { useCase } = setup();
    const error = unwrapErr(await useCase.execute(input("unknown", 0, 25, 25, ScoreReason.BUDGET)));
    expect(error.message).toContain("not found");
  });

  it("rejects a whitespace-only leadId (passes Zod's min(1), fails LeadId.create's trim check)", async () => {
    const { useCase } = setup();
    const error = unwrapErr(await useCase.execute(input("   ", 0, 25, 25, ScoreReason.BUDGET)));
    expect(error.message).toContain("LeadId");
  });

  it("surfaces a repository error on the initial lead lookup", async () => {
    const { useCase, client, row } = setup();
    client.forceErrorOnce("leads", "connection reset");
    const error = unwrapErr(await useCase.execute(input(row.id, 0, 25, 25, ScoreReason.BUDGET)));
    expect(error.message).toContain("connection reset");
  });

  it("rejects a scoreBefore outside [0, 100] (ScoringEvent entity validation)", async () => {
    const { useCase, row } = setup();
    const error = unwrapErr(await useCase.execute(input(row.id, -50, 25, 75, ScoreReason.BUDGET)));
    expect(error.message).toContain("scoreBefore");
  });

  it("rejects an invalid reason", async () => {
    const { useCase, row } = setup();
    const error = unwrapErr(
      await useCase.execute({
        ...input(row.id, 0, 25, 25, ScoreReason.BUDGET),
        reason: "MOOD" as ScoreReason,
      }),
    );
    expect(error.message).toContain("validation failed");
  });

  it("emits ScoreUpdated on every call", async () => {
    const { useCase, row, publisher } = setup();
    await useCase.execute(input(row.id, 0, 25, 25, ScoreReason.BUDGET));
    expect(publisher.published[0]).toMatchObject({ type: "aaos.lead-store.lead.score-updated" });
  });

  it("surfaces a repository error on the scoring event insert", async () => {
    const { useCase, client, row } = setup();
    client.forceErrorOnce("scoring_events", "db error");
    const error = unwrapErr(await useCase.execute(input(row.id, 0, 25, 25, ScoreReason.BUDGET)));
    expect(error.message).toContain("db error");
  });

  it("surfaces a repository error on the lead update", async () => {
    const { useCase, client, row } = setup();
    client.forceErrorOnce("leads", "row locked", 1);
    const error = unwrapErr(await useCase.execute(input(row.id, 0, 25, 25, ScoreReason.BUDGET)));
    expect(error.message).toContain("row locked");
  });
});
