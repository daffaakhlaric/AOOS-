import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
const sql = (name: string) =>
  readFileSync(new URL(`../../../../supabase/migrations/${name}.sql`, import.meta.url), "utf8");
const worker = randomUUID();
async function event(recurrence = "ONCE") {
  const id = randomUUID();
  await db.query(
    "insert into calendar_events(id,tenant_id,event_type,title,scheduled_at,recurrence) values($1,'tenant-a','SAMANTHA_ANALYZE','Review',now()-interval '2 hours',$2)",
    [id, recurrence],
  );
  return id;
}
async function claim(id: string, tenant = "tenant-a") {
  const result = await db.query<{ run: { id: string; correlation_id: string } | null }>(
    "select claim_advertising_loop($1,$2,$3) as run",
    [tenant, id, worker],
  );
  return result.rows[0]!.run;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon;create role authenticated;create role service_role;");
  for (const [file, table] of [
    ["006_calendar_events", "calendar_events"],
    ["048_campaign_auto_publish", "loop_runs"],
  ]) {
    const ddl = sql(file!).match(new RegExp(`CREATE TABLE ${table} \\([\\s\\S]*?\\n\\);`))?.[0];
    if (!ddl) throw new Error("Missing table fixture");
    await db.exec(ddl);
  }
  await db.exec(sql("067_autonomous_loop_runtime"));
  await db.exec("alter table loop_runs drop column trigger_contract");
  await db.exec(sql("068_loop_trigger_contract"));
  await db.exec(sql("068_loop_trigger_contract"));
}, 30000);
afterAll(async () => {
  await db?.close();
});
it("claims one event once across concurrent callers with stable correlation", async () => {
  const id = await event();
  const runs = await Promise.all([claim(id), claim(id)]);
  expect(runs.filter(Boolean)).toHaveLength(1);
  const run = runs.find(Boolean)!;
  expect(run.correlation_id).toBe(run.id);
  const stored = await db.query<{ trigger_contract: { type: string; correlationId: string } }>(
    "select trigger_contract from loop_runs where id=$1",
    [run.id],
  );
  expect(stored.rows[0]!.trigger_contract).toMatchObject({
    type: "scheduler.event.due.v1",
    correlationId: run.id,
  });
  expect((await db.query("select status from calendar_events where id=$1", [id])).rows[0]).toEqual({
    status: "RUNNING",
  });
});
it("does not claim another tenant's event", async () => {
  expect(await claim(await event(), "tenant-b")).toBeNull();
});
it("atomically completes a loop, its calendar event and its next review", async () => {
  const id = await event("DAILY"),
    run = (await claim(id))!;
  const result = await db.query(
    "select finish_advertising_loop('tenant-a',$1,$2,true,'{\"summary\":\"reviewed\"}',null,now()+interval '1 day') as ok",
    [run.id, worker],
  );
  expect(result.rows[0]).toEqual({ ok: true });
  expect((await db.query("select status from loop_runs where id=$1", [run.id])).rows[0]).toEqual({
    status: "COMPLETED",
  });
  expect(
    (await db.query("select status from calendar_events where parent_event_id=$1", [id])).rows,
  ).toEqual([{ status: "PENDING" }]);
  expect(await claim(id)).toBeNull();
  expect(
    (
      await db.query("select finish_advertising_loop('tenant-a',$1,$2,true,'{}') as ok", [
        run.id,
        worker,
      ])
    ).rows[0],
  ).toEqual({ ok: false });
});
it("rejects a stale worker and rolls back invalid recurrence completion", async () => {
  const id = await event(),
    run = (await claim(id))!;
  expect(
    (
      await db.query("select heartbeat_advertising_loop('tenant-a',$1,$2) as ok", [
        run.id,
        randomUUID(),
      ])
    ).rows[0],
  ).toEqual({ ok: false });
  await expect(
    db.query(
      "select finish_advertising_loop('tenant-a',$1,$2,true,'{}',null,now()+interval '1 day')",
      [run.id, worker],
    ),
  ).rejects.toThrow("INVALID_NEXT_REVIEW");
  expect((await db.query("select status from loop_runs where id=$1", [run.id])).rows[0]).toEqual({
    status: "RUNNING",
  });
});
it("blocks expired execution without automatically replaying side effects", async () => {
  const id = await event(),
    run = (await claim(id))!;
  await db.query("update loop_runs set lease_until=now()-interval '1 second' where id=$1", [
    run.id,
  ]);
  await db.query("select reconcile_advertising_loops('tenant-a')");
  expect(
    (await db.query("select status,error_code from loop_runs where id=$1", [run.id])).rows[0],
  ).toEqual({ status: "BLOCKED", error_code: "EXECUTION_UNCERTAIN" });
  expect(await claim(id)).toBeNull();
  expect(
    (
      await db.query("select finish_advertising_loop('tenant-a',$1,$2,true,'{}') as ok", [
        run.id,
        worker,
      ])
    ).rows[0],
  ).toEqual({ ok: false });
});
it("denies direct browser-role RPC execution", async () => {
  await db.exec("set role authenticated");
  try {
    await expect(db.query("select reconcile_advertising_loops('tenant-a')")).rejects.toThrow(
      "permission denied",
    );
  } finally {
    await db.exec("reset role");
  }
});
