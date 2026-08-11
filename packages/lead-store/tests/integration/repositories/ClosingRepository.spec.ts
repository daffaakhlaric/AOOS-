import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { ClosingMapper } from "../../../src/infrastructure/mappers/ClosingMapper.js";
import { ClosingRepository } from "../../../src/infrastructure/supabase/ClosingRepository.js";
import { makeClosingRow } from "../../fixtures/leadStoreFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

const FROM = new Date("2026-01-01T00:00:00.000Z");
const TO = new Date("2026-01-31T23:59:59.000Z");

describe("ClosingRepository", () => {
  it("insert adds a new row", async () => {
    const client = createFakeSupabaseClient();
    const repo = new ClosingRepository(client);
    const closing = unwrap(ClosingMapper.toDomain(makeClosingRow()));
    const inserted = unwrap(await repo.insert(closing));
    expect(inserted.id.toString()).toBe(closing.id.toString());
    expect(client.rows("closings")).toHaveLength(1);
  });

  it("insert surfaces 'no row returned' when the write resolves with no data", async () => {
    const client = createFakeSupabaseClient();
    client.forceNullOnce("closings");
    const repo = new ClosingRepository(client);
    const closing = unwrap(ClosingMapper.toDomain(makeClosingRow()));
    const error = unwrapErr(await repo.insert(closing));
    expect(error.message).toContain("no row returned");
  });

  it("insert surfaces a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("closings", "db error");
    const repo = new ClosingRepository(client);
    const closing = unwrap(ClosingMapper.toDomain(makeClosingRow()));
    const error = unwrapErr(await repo.insert(closing));
    expect(error.message).toContain("db error");
  });

  it("findByFilter filters by date range", async () => {
    const client = createFakeSupabaseClient();
    client.seed("closings", [
      makeClosingRow({ created_at: "2026-01-15T00:00:00.000Z" }),
      makeClosingRow({ created_at: "2026-03-01T00:00:00.000Z" }),
    ]);
    const repo = new ClosingRepository(client);
    const result = unwrap(await repo.findByFilter({ fromDate: FROM, toDate: TO }));
    expect(result).toHaveLength(1);
  });

  it("findByFilter filters by campaignId", async () => {
    const client = createFakeSupabaseClient();
    client.seed("closings", [
      makeClosingRow({ campaign_id: "#C047", created_at: "2026-01-15T00:00:00.000Z" }),
      makeClosingRow({ campaign_id: "#C099", created_at: "2026-01-16T00:00:00.000Z" }),
    ]);
    const repo = new ClosingRepository(client);
    const result = unwrap(
      await repo.findByFilter({ campaignId: "#C047", fromDate: FROM, toDate: TO }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.campaignId).toBe("#C047");
  });

  it("findByFilter filters by adId", async () => {
    const client = createFakeSupabaseClient();
    client.seed("closings", [
      makeClosingRow({ ad_id: "#A001", created_at: "2026-01-15T00:00:00.000Z" }),
      makeClosingRow({ ad_id: "#A002", created_at: "2026-01-16T00:00:00.000Z" }),
    ]);
    const repo = new ClosingRepository(client);
    const result = unwrap(await repo.findByFilter({ adId: "#A001", fromDate: FROM, toDate: TO }));
    expect(result).toHaveLength(1);
  });

  it("findByFilter filters by branchId", async () => {
    const client = createFakeSupabaseClient();
    client.seed("closings", [
      makeClosingRow({ branch_id: BranchId.BINTARO, created_at: "2026-01-15T00:00:00.000Z" }),
      makeClosingRow({ branch_id: BranchId.CINERE, created_at: "2026-01-16T00:00:00.000Z" }),
    ]);
    const repo = new ClosingRepository(client);
    const result = unwrap(
      await repo.findByFilter({ branchId: BranchId.BINTARO, fromDate: FROM, toDate: TO }),
    );
    expect(result).toHaveLength(1);
  });

  it("findByFilter surfaces a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("closings", "timeout");
    const repo = new ClosingRepository(client);
    const error = unwrapErr(await repo.findByFilter({ fromDate: FROM, toDate: TO }));
    expect(error.message).toContain("timeout");
  });

  it("findByFilter propagates a mapping failure", async () => {
    const client = createFakeSupabaseClient();
    client.seed("closings", [
      makeClosingRow({ closing_type: "REFUND", created_at: "2026-01-15T00:00:00.000Z" }),
    ]);
    const repo = new ClosingRepository(client);
    const error = unwrapErr(await repo.findByFilter({ fromDate: FROM, toDate: TO }));
    expect(error.message).toContain("row mapping failed");
  });
});
