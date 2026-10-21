import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";
it("atomically versions, rejects stale saves, isolates tenants and schedules re-evaluation", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon;create role authenticated;create role service_role;");
    const sql = (n: string) =>
      readFileSync(new URL(`../../../supabase/migrations/${n}.sql`, import.meta.url), "utf8");
    await db.exec(
      sql("006_calendar_events").match(/CREATE TABLE calendar_events \([\s\S]*?\n\);/)![0],
    );
    await db.exec(sql("069_growth_policy"));
    await db.exec(sql("069_growth_policy"));
    await db.query("select save_growth_policy('a',0,'{}','user-a')");
    await expect(db.query("select save_growth_policy('a',0,'{}','user-a')")).rejects.toThrow(
      "STALE_POLICY",
    );
    await db.query("select save_growth_policy('a',1,'{\"pace\":\"MODERATE\"}','user-a')");
    await db.query("select save_growth_policy('b',0,'{}','user-b')");
    expect(
      (await db.query("select version from growth_policies where tenant_id='a'")).rows,
    ).toEqual([{ version: 2 }]);
    expect(
      (await db.query("select * from growth_policy_versions where tenant_id='a'")).rows,
    ).toHaveLength(2);
    expect((await db.query("select * from calendar_events where tenant_id='a'")).rows).toHaveLength(
      2,
    );
    await db.exec("set role authenticated");
    await expect(db.query("select save_growth_policy('a',2,'{}','viewer')")).rejects.toThrow(
      "permission denied",
    );
  } finally {
    await db.close();
  }
}, 30000);
