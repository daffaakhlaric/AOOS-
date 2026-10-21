import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const id = "6cb4339b-9c5e-4160-b35d-7f54b48b53b0";
const briefId = "91939630-4b0d-42c7-954e-fd2338449223";
let db: PGlite;
const input = { id, listingId: id, name: "Test" };
function save(
  tenant = "tenant-a",
  revision = 0,
  hash = "v1",
  missing: string[] = [],
  data = input,
  proposedBriefId = briefId,
) {
  const brief = missing.length
    ? null
    : { briefId: proposedBriefId, tenantId: tenant, campaignDraftId: id, listingId: id };
  return db.query<{
    result: {
      draft: { revision: number; status: string };
      project: { id: string; status: string } | null;
    };
  }>(
    "select public.save_campaign_creative_handoff($1,$2::uuid,$3::uuid,$4::jsonb,$5,$6::jsonb,$7,$8::text[]) as result",
    [
      tenant,
      id,
      id,
      JSON.stringify(data),
      revision,
      brief ? JSON.stringify(brief) : null,
      brief ? hash : null,
      missing,
    ],
  );
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;");
  await db.exec(
    readFileSync(
      new URL("../../../../supabase/migrations/064_campaign_creative_handoff.sql", import.meta.url),
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});

describe("atomic campaign/Kai migration on PostgreSQL", () => {
  it("commits one project and one brief for repeated/concurrent first saves", async () => {
    const results = await Promise.all([save(), save(), save()]);
    expect(new Set(results.map((r) => r.rows[0]?.result.project?.id)).size).toBe(1);
    expect((await db.query("select * from public.kai_projects")).rows).toHaveLength(1);
    expect((await db.query("select * from public.structured_creative_briefs")).rows).toHaveLength(
      1,
    );
    expect(results[0]?.rows[0]?.result.draft.revision).toBe(1);
  });
  it("rejects stale edits without modifying the existing project", async () => {
    await expect(
      save("tenant-a", 0, "changed", [], { ...input, name: "Stale edit" }),
    ).rejects.toThrow("DRAFT_REVISION_CONFLICT");
    expect(
      (
        await db.query<{ data: { name: string } }>(
          "select data from public.campaign_creative_drafts where tenant_id='tenant-a'",
        )
      ).rows[0]?.data.name,
    ).toBe("Test");
  });
  it("separates identical client draft IDs in different tenants", async () => {
    const second = await save("tenant-b");
    const first = await save("tenant-a");
    expect(second.rows[0]?.result.project?.id).not.toBe(first.rows[0]?.result.project?.id);
  });
  it("keeps the same project but blocks it when required brief data disappears", async () => {
    const before = await save("tenant-a");
    const after = await save("tenant-a", 1, "", ["CTA.destination"]);
    expect(after.rows[0]?.result.draft.status).toBe("NEEDS_INPUT");
    expect(after.rows[0]?.result.project?.id).toBe(before.rows[0]?.result.project?.id);
    expect(after.rows[0]?.result.project?.status).toBe("NEEDS_INPUT");
    expect(
      (await db.query("select * from public.structured_creative_briefs where tenant_id='tenant-a'"))
        .rows,
    ).toHaveLength(1);
  });
  it("does not create an incomplete project, and retries NEEDS_INPUT idempotently", async () => {
    const result = await save("tenant-c", 0, "", ["CTA.destination"]);
    const retry = await save("tenant-c", 0, "", ["CTA.destination"]);
    expect(result.rows[0]?.result.project).toBeNull();
    expect(retry.rows[0]?.result.draft.revision).toBe(1);
  });
  it("prevents cross-tenant brief references at the database layer", async () => {
    await expect(
      db.exec(
        `insert into public.kai_projects(tenant_id,campaign_draft_id,creative_brief_id) values('tenant-c','${id}','${briefId}')`,
      ),
    ).rejects.toThrow(/foreign key/i);
  });
  it("retains historical brief versions while pointing the same project at the new version", async () => {
    const nextBrief = "418de873-4bce-443d-b9c1-739068bcaa79";
    const before = await save("tenant-b");
    const after = await save("tenant-b", 1, "v2", [], { ...input, name: "Updated" }, nextBrief);
    expect(after.rows[0]?.result.project?.id).toBe(before.rows[0]?.result.project?.id);
    expect(
      (await db.query("select * from public.structured_creative_briefs where tenant_id='tenant-b'"))
        .rows,
    ).toHaveLength(2);
    const pointer = await db.query<{ creative_brief_id: string }>(
      "select creative_brief_id from public.kai_projects where tenant_id='tenant-b'",
    );
    expect(pointer.rows[0]?.creative_brief_id).toBe(nextBrief);
  });
  it("rolls back the entire save when brief persistence fails", async () => {
    await expect(
      save("tenant-b", 2, "v3", [], { ...input, name: "Must rollback" }),
    ).rejects.toThrow(/duplicate key/i);
    const actual = await db.query<{ data: { name: string }; revision: number }>(
      "select data,revision from public.campaign_creative_drafts where tenant_id='tenant-b'",
    );
    expect(actual.rows[0]).toMatchObject({ data: { name: "Updated" }, revision: 2 });
  });
  it("denies anonymous table and RPC access", async () => {
    await db.exec("set role anon");
    try {
      await expect(db.query("select * from public.kai_projects")).rejects.toThrow(
        /permission denied/i,
      );
      await expect(save("tenant-z")).rejects.toThrow(/permission denied/i);
    } finally {
      await db.exec("reset role");
    }
  });
});
