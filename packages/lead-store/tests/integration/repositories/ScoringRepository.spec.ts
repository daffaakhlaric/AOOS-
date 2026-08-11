import { describe, expect, it } from "vitest";

import { ScoringEvent } from "../../../src/domain/entities/ScoringEvent.js";
import { LeadId } from "../../../src/domain/value-objects/LeadId.js";
import { ScoreReason } from "../../../src/domain/value-objects/ScoreReason.js";
import { ScoringRepository } from "../../../src/infrastructure/supabase/ScoringRepository.js";
import { makeScoringEventRow } from "../../fixtures/leadStoreFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

function makeEvent(leadId = LeadId.generate()) {
  return unwrap(
    ScoringEvent.create({
      id: "score-x",
      leadId,
      scoreBefore: 0,
      scoreAfter: 25,
      delta: 25,
      reason: ScoreReason.BUDGET,
      createdAt: new Date(),
    }),
  );
}

describe("ScoringRepository", () => {
  it("insert adds a new row", async () => {
    const client = createFakeSupabaseClient();
    const repo = new ScoringRepository(client);
    const inserted = unwrap(await repo.insert(makeEvent()));
    expect(inserted.scoreAfter).toBe(25);
    expect(client.rows("scoring_events")).toHaveLength(1);
  });

  it("insert surfaces 'no row returned' when the write resolves with no data", async () => {
    const client = createFakeSupabaseClient();
    client.forceNullOnce("scoring_events");
    const repo = new ScoringRepository(client);
    const error = unwrapErr(await repo.insert(makeEvent()));
    expect(error.message).toContain("no row returned");
  });

  it("insert surfaces a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("scoring_events", "db error");
    const repo = new ScoringRepository(client);
    const error = unwrapErr(await repo.insert(makeEvent()));
    expect(error.message).toContain("db error");
  });

  it("findByLeadId returns every event for the lead, ordered ascending", async () => {
    const client = createFakeSupabaseClient();
    const leadId = "lead-shared";
    client.seed("scoring_events", [
      makeScoringEventRow({ lead_id: leadId, created_at: "2026-01-15T09:01:00.000Z", delta: 25 }),
      makeScoringEventRow({ lead_id: leadId, created_at: "2026-01-15T09:00:00.000Z", delta: 20 }),
      makeScoringEventRow({ lead_id: "other-lead", delta: 99 }),
    ]);
    const repo = new ScoringRepository(client);
    const result = unwrap(await repo.findByLeadId(unwrap(LeadId.create(leadId))));
    expect(result).toHaveLength(2);
    expect(result[0]?.delta).toBe(20);
    expect(result[1]?.delta).toBe(25);
  });

  it("findByLeadId surfaces a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("scoring_events", "timeout");
    const repo = new ScoringRepository(client);
    const error = unwrapErr(await repo.findByLeadId(LeadId.generate()));
    expect(error.message).toContain("timeout");
  });

  it("findByLeadId propagates a mapping failure (invalid reason)", async () => {
    const client = createFakeSupabaseClient();
    const leadId = "lead-bad";
    client.seed("scoring_events", [makeScoringEventRow({ lead_id: leadId, reason: "MOOD" })]);
    const repo = new ScoringRepository(client);
    const error = unwrapErr(await repo.findByLeadId(unwrap(LeadId.create(leadId))));
    expect(error.message).toContain("row mapping failed");
  });
});
