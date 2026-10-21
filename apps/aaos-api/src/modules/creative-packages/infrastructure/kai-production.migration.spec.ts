import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";

let db: PGlite;
const draftId = randomUUID(),
  briefId = randomUUID(),
  conceptId = randomUUID(),
  boardId = randomUUID();
let projectId: string;
const concept = {
  id: conceptId,
  ordinal: 0,
  title: "Lokasi",
  legacyAngle: "LOKASI_STRATEGIS",
  persona: "Pembeli",
  format: "IMAGE",
  message: "Listing BSD",
  hypothesis: "Informasi lokasi membantu evaluasi",
  sourceUrls: [],
  storyboard: { id: boardId, scenes: [] },
};
const ensure = (tenant = "test") =>
  db.query("select ensure_kai_concepts($1,$2,$3,$4) as result", [
    tenant,
    projectId,
    briefId,
    JSON.stringify([concept]),
  ]);
beforeAll(async () => {
  db = new PGlite();
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;");
  for (const file of [
    "003_creative_packages",
    "026_creative_packages_property",
    "064_campaign_creative_handoff",
    "065_kai_production_lifecycle",
    "066_kai_generation_enqueue",
    "071_kai_sample_render",
    "072_kai_reviewed_enqueue",
  ]) {
    await db.exec(
      readFileSync(
        new URL(`../../../../supabase/migrations/${file}.sql`, import.meta.url),
        "utf8",
      ).replace("CREATE EXTENSION IF NOT EXISTS pgcrypto;", ""),
    );
  }
  const result = await db.query<{ result: { project: { id: string } } }>(
    "select save_campaign_creative_handoff($1,$2,$2,$3,0,$4,$5,'{}') as result",
    [
      "test",
      draftId,
      JSON.stringify({ id: draftId, listingId: draftId }),
      JSON.stringify({
        briefId,
        tenantId: "test",
        campaignDraftId: draftId,
        listingId: draftId,
        createdBy: "SAMANTHA",
      }),
      "v1",
    ],
  );
  projectId = result.rows[0]!.result.project.id;
}, 30000);
afterAll(async () => {
  await db?.close();
});
it("persists one concept, legacy package and initial storyboard across duplicate requests", async () => {
  await Promise.all([ensure(), ensure()]);
  for (const table of ["kai_concepts", "creative_packages", "kai_storyboards"])
    expect((await db.query(`select * from ${table}`)).rows).toHaveLength(1);
});
it("queues each concept exactly once and moves the project into production", async () => {
  const result = await db.query<{ jobs: unknown[] }>(
    "select enqueue_kai_generation_jobs($1,$2,$3) as jobs",
    ["test", projectId, [conceptId]],
  );
  const retry = await db.query<{ jobs: unknown[] }>(
    "select enqueue_kai_generation_jobs($1,$2,$3) as jobs",
    ["test", projectId, [conceptId]],
  );
  expect(result.rows[0]!.jobs).toHaveLength(1);
  expect(retry.rows[0]!.jobs).toHaveLength(1);
  expect(
    (await db.query("select * from kai_generation_jobs where tenant_id='test'")).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query<{ status: string }>(
        "select status from kai_projects where tenant_id='test' and id=$1",
        [projectId],
      )
    ).rows[0]!.status,
  ).toBe("IN_PRODUCTION");
});
it("rejects a different tenant's project and keeps all rows unchanged", async () => {
  await expect(ensure("other")).rejects.toThrow("BRIEF_NOT_READY");
  expect((await db.query("select * from kai_concepts")).rows).toHaveLength(1);
});
it("versions storyboard edits and rejects stale overwrite", async () => {
  const update = () =>
    db.query("select save_kai_storyboard($1,$2,1,$3,$4)", [
      "test",
      conceptId,
      randomUUID(),
      JSON.stringify({ scenes: [{ title: "Updated" }] }),
    ]);
  await update();
  await expect(update()).rejects.toThrow("STORYBOARD_REVISION_CONFLICT");
  expect((await db.query("select * from kai_storyboards")).rows).toHaveLength(2);
});
it("leases a due generation job once across two workers", async () => {
  await db.exec("update kai_generation_jobs set status='READY' where tenant_id='test'");
  const jobId = randomUUID();
  await db.query(
    "insert into kai_generation_jobs(tenant_id,id,project_id,concept_id,brief_id,storyboard_id,idempotency_key,model,format,plan) values('test',$1,$2,$3,$4,$5,'same-output','model','IMAGE','{}')",
    [jobId, projectId, conceptId, briefId, boardId],
  );
  const claim = () =>
    db.query<{ job: unknown }>("select claim_kai_generation_job($1) as job", [randomUUID()]);
  const results = await Promise.all([claim(), claim()]);
  expect(results.filter((r) => r.rows[0]!.job !== null)).toHaveLength(1);
});
it("denies anonymous table reads and privileged job claims", async () => {
  await db.exec("SET ROLE anon");
  try {
    await expect(db.query("select * from kai_generation_jobs")).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.query("select claim_kai_generation_job($1)", [randomUUID()])).rejects.toThrow(
      /permission denied/,
    );
  } finally {
    await db.exec("RESET ROLE");
  }
});
it("deduplicates samples separately from full production and forbids publish-ready status", async () => {
  const sample = () =>
    db.query<{ job: { id: string; plan: { renderMode: string } } }>(
      "select enqueue_kai_sample_job($1,$2,$3) as job",
      ["test", projectId, conceptId],
    );
  const a = await sample(),
    b = await sample();
  expect(a.rows[0]!.job.id).toBe(b.rows[0]!.job.id);
  expect(a.rows[0]!.job.plan.renderMode).toBe("SAMPLE");
  await expect(
    db.query("update kai_generation_jobs set status='READY' where id=$1", [a.rows[0]!.job.id]),
  ).rejects.toThrow("kai_sample_not_publishable");
  await db.query("update kai_generation_jobs set status='SAMPLE_READY' where id=$1", [
    a.rows[0]!.job.id,
  ]);
  await expect(
    db.query("select enqueue_kai_sample_job($1,$2,$3)", ["other", projectId, conceptId]),
  ).rejects.toThrow("BRIEF_NOT_READY");
});

it("rejects stale reviewed revisions atomically and preserves idempotency", async () => {
  const run = (revision: number, tenant = "test") =>
    db.query<{ job: { id: string } }>(
      "select enqueue_kai_reviewed_jobs($1,$2,$3,$4,'SAMPLE') as job",
      [tenant, projectId, [conceptId], JSON.stringify({ [conceptId]: revision })],
    );
  const before = (await db.query("select * from kai_generation_jobs")).rows.length;
  await expect(run(1)).rejects.toThrow("STORYBOARD_REVISION_CONFLICT");
  expect((await db.query("select * from kai_generation_jobs")).rows).toHaveLength(before);
  const a = await run(2),
    b = await run(2);
  expect(a.rows[0]!.job.id).toBe(b.rows[0]!.job.id);
  await expect(run(2, "other")).rejects.toThrow("BRIEF_NOT_READY");
});
