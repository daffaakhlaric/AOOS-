import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { LeadMapper } from "../../../src/infrastructure/mappers/LeadMapper.js";
import { LeadRepository } from "../../../src/infrastructure/supabase/LeadRepository.js";
import { makeLeadRow } from "../../fixtures/leadStoreFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

describe("LeadRepository", () => {
  it("findById returns undefined when no row matches", async () => {
    const client = createFakeSupabaseClient();
    const repo = new LeadRepository(client);
    const result = unwrap(
      await repo.findById(unwrap(LeadMapper.toDomain(makeLeadRow())).id, "dss-motor"),
    );
    expect(result).toBeUndefined();
  });

  it("findById returns the mapped lead when found", async () => {
    const client = createFakeSupabaseClient();
    const row = makeLeadRow();
    client.seed("leads", [row]);
    const repo = new LeadRepository(client);
    const lead = unwrap(LeadMapper.toDomain(row));
    const found = unwrap(await repo.findById(lead.id, "dss-motor"));
    expect(found?.id.toString()).toBe(row.id);
  });

  it("findById surfaces a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("leads", "connection reset");
    const repo = new LeadRepository(client);
    const lead = unwrap(LeadMapper.toDomain(makeLeadRow()));
    const error = unwrapErr(await repo.findById(lead.id, "dss-motor"));
    expect(error.message).toContain("connection reset");
  });

  /**
   * PROPERTY-TENANT-ISOLATION Phase 1 — THE security-critical regression test. Before this Phase's
   * fix, `findById` filtered only by `id`, so tenant B could fetch (and, via every use case chained
   * off it — claim/status/message/etc.) act on tenant A's lead just by knowing its UUID. Verified
   * this test actually fails without the fix: temporarily reverting `LeadRepository.findById` to
   * drop the `.eq("tenant_id", tenantId)` filter makes this assertion fail (`found` resolves to the
   * tenant-A row instead of `undefined`) — see this session's final report for the exact repro.
   */
  it("findById does NOT return a lead belonging to a different tenant (real IDOR fix)", async () => {
    const client = createFakeSupabaseClient();
    const row = makeLeadRow({ tenant_id: "tenant-a" });
    client.seed("leads", [row]);
    const repo = new LeadRepository(client);
    const lead = unwrap(LeadMapper.toDomain(row));
    const found = unwrap(await repo.findById(lead.id, "tenant-b"));
    expect(found).toBeUndefined();
  });

  it("findById DOES return the lead when queried with its own real tenant id", async () => {
    const client = createFakeSupabaseClient();
    const row = makeLeadRow({ tenant_id: "tenant-a" });
    client.seed("leads", [row]);
    const repo = new LeadRepository(client);
    const lead = unwrap(LeadMapper.toDomain(row));
    const found = unwrap(await repo.findById(lead.id, "tenant-a"));
    expect(found?.id.toString()).toBe(row.id);
  });

  it("findByPhoneAndBranch returns undefined when no match", async () => {
    const client = createFakeSupabaseClient();
    const repo = new LeadRepository(client);
    const result = unwrap(
      await repo.findByPhoneAndBranch("+6281200000000", BranchId.BINTARO, "dss-motor"),
    );
    expect(result).toBeUndefined();
  });

  it("findByPhoneAndBranch returns the matching lead", async () => {
    const client = createFakeSupabaseClient();
    const row = makeLeadRow({ lead_phone: "+6281234500000", branch_id: BranchId.CINERE });
    client.seed("leads", [row]);
    const repo = new LeadRepository(client);
    const found = unwrap(
      await repo.findByPhoneAndBranch("+6281234500000", BranchId.CINERE, "dss-motor"),
    );
    expect(found?.leadPhone.toString()).toBe("+6281234500000");
  });

  it("findByPhoneAndBranch does NOT match a same phone+branch lead belonging to a different tenant", async () => {
    const client = createFakeSupabaseClient();
    const row = makeLeadRow({
      lead_phone: "+6281234500000",
      branch_id: BranchId.CINERE,
      tenant_id: "other-tenant",
    });
    client.seed("leads", [row]);
    const repo = new LeadRepository(client);
    const found = unwrap(
      await repo.findByPhoneAndBranch("+6281234500000", BranchId.CINERE, "dss-motor"),
    );
    expect(found).toBeUndefined();
  });

  it("insert adds a new row and returns the mapped lead", async () => {
    const client = createFakeSupabaseClient();
    const repo = new LeadRepository(client);
    const lead = unwrap(LeadMapper.toDomain(makeLeadRow()));
    const inserted = unwrap(await repo.insert(lead));
    expect(inserted.id.toString()).toBe(lead.id.toString());
    expect(client.rows("leads")).toHaveLength(1);
  });

  it("insert surfaces a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("leads", "unique violation");
    const repo = new LeadRepository(client);
    const lead = unwrap(LeadMapper.toDomain(makeLeadRow()));
    const error = unwrapErr(await repo.insert(lead));
    expect(error.message).toContain("unique violation");
  });

  it("update mutates the existing row", async () => {
    const client = createFakeSupabaseClient();
    const row = makeLeadRow({ score: 0 });
    client.seed("leads", [row]);
    const repo = new LeadRepository(client);
    const lead = unwrap(LeadMapper.toDomain(row)).withScore(50, "WARM" as never, new Date());
    const updated = unwrap(await repo.update(lead));
    expect(updated.score).toBe(50);
    expect(client.rows("leads")[0]?.score).toBe(50);
  });

  it("findByBranch returns only matching-branch leads", async () => {
    const client = createFakeSupabaseClient();
    client.seed("leads", [
      makeLeadRow({ branch_id: BranchId.BINTARO }),
      makeLeadRow({ branch_id: BranchId.CINERE }),
    ]);
    const repo = new LeadRepository(client);
    const result = unwrap(await repo.findByBranch(BranchId.BINTARO, "dss-motor"));
    expect(result).toHaveLength(1);
    expect(result[0]?.branchId).toBe(BranchId.BINTARO);
  });

  it("findByBranch does NOT return a same-branch lead belonging to a different tenant", async () => {
    const client = createFakeSupabaseClient();
    client.seed("leads", [
      makeLeadRow({ branch_id: BranchId.BINTARO, tenant_id: "dss-motor" }),
      makeLeadRow({ branch_id: BranchId.BINTARO, tenant_id: "other-tenant" }),
    ]);
    const repo = new LeadRepository(client);
    const result = unwrap(await repo.findByBranch(BranchId.BINTARO, "dss-motor"));
    expect(result).toHaveLength(1);
  });

  it("findHotByBranch returns only HOT leads for the branch", async () => {
    const client = createFakeSupabaseClient();
    client.seed("leads", [
      makeLeadRow({ branch_id: BranchId.BINTARO, status: "HOT" }),
      makeLeadRow({ branch_id: BranchId.BINTARO, status: "WARM" }),
      makeLeadRow({ branch_id: BranchId.CINERE, status: "HOT" }),
    ]);
    const repo = new LeadRepository(client);
    const result = unwrap(await repo.findHotByBranch(BranchId.BINTARO, "dss-motor"));
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("HOT");
  });

  it("findHotByBranch does NOT return a same-branch HOT lead belonging to a different tenant", async () => {
    const client = createFakeSupabaseClient();
    client.seed("leads", [
      makeLeadRow({ branch_id: BranchId.BINTARO, status: "HOT", tenant_id: "dss-motor" }),
      makeLeadRow({ branch_id: BranchId.BINTARO, status: "HOT", tenant_id: "other-tenant" }),
    ]);
    const repo = new LeadRepository(client);
    const result = unwrap(await repo.findHotByBranch(BranchId.BINTARO, "dss-motor"));
    expect(result).toHaveLength(1);
  });

  it("findBySales returns only leads assigned to that sales human", async () => {
    const client = createFakeSupabaseClient();
    client.seed("leads", [
      makeLeadRow({ assigned_sales_id: "sales-1" }),
      makeLeadRow({ assigned_sales_id: "sales-2" }),
    ]);
    const repo = new LeadRepository(client);
    const result = unwrap(
      await repo.findBySales(
        { toString: () => "sales-1" } as unknown as Parameters<typeof repo.findBySales>[0],
        "dss-motor",
      ),
    );
    expect(result).toHaveLength(1);
  });

  it("findBySales does NOT return a same-sales-human lead belonging to a different tenant", async () => {
    const client = createFakeSupabaseClient();
    client.seed("leads", [
      makeLeadRow({ assigned_sales_id: "sales-1", tenant_id: "dss-motor" }),
      makeLeadRow({ assigned_sales_id: "sales-1", tenant_id: "other-tenant" }),
    ]);
    const repo = new LeadRepository(client);
    const result = unwrap(
      await repo.findBySales(
        { toString: () => "sales-1" } as unknown as Parameters<typeof repo.findBySales>[0],
        "dss-motor",
      ),
    );
    expect(result).toHaveLength(1);
  });

  it("insert surfaces 'no row returned' when the write resolves with no data", async () => {
    const client = createFakeSupabaseClient();
    client.forceNullOnce("leads");
    const repo = new LeadRepository(client);
    const lead = unwrap(LeadMapper.toDomain(makeLeadRow()));
    const error = unwrapErr(await repo.insert(lead));
    expect(error.message).toContain("no row returned");
  });

  it("update surfaces 'no row returned' when the write resolves with no data", async () => {
    const client = createFakeSupabaseClient();
    client.seed("leads", [makeLeadRow()]);
    client.forceNullOnce("leads");
    const repo = new LeadRepository(client);
    const lead = unwrap(LeadMapper.toDomain(makeLeadRow()));
    const error = unwrapErr(await repo.update(lead));
    expect(error.message).toContain("no row returned");
  });

  it("update surfaces a Supabase error", async () => {
    const client = createFakeSupabaseClient();
    client.seed("leads", [makeLeadRow()]);
    client.forceErrorOnce("leads", "row locked");
    const repo = new LeadRepository(client);
    const lead = unwrap(LeadMapper.toDomain(makeLeadRow()));
    const error = unwrapErr(await repo.update(lead));
    expect(error.message).toContain("row locked");
  });

  it("findByBranch propagates a mapping failure as a SupabaseError", async () => {
    const client = createFakeSupabaseClient();
    client.seed("leads", [makeLeadRow({ status: "BOGUS" })]);
    const repo = new LeadRepository(client);
    const error = unwrapErr(await repo.findByBranch(BranchId.BINTARO, "dss-motor"));
    expect(error.message).toContain("row mapping failed");
  });
});
