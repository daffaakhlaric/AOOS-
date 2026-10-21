import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("claims once, isolates tenants, and prevents replay after uncertain execution", async () => {
  const db = new PGlite();
  try {
    const sql = (name: string) =>
      readFileSync(new URL(`../../../supabase/migrations/${name}.sql`, import.meta.url), "utf8");
    await db.exec(
      sql("031_operating_mode").match(/CREATE TABLE pending_agent_actions \([\s\S]*?\n\);/)![0],
    );
    await db.exec(sql("070_pending_action_execution"));
    await db.exec(sql("070_pending_action_execution"));
    await db.exec(
      "insert into pending_agent_actions (tenant_id,agent,action_type,payload) values ('a','SAMANTHA','SCALE','{}')",
    );
    const claim = (tenant: string, state: string) =>
      db.query(
        "update pending_agent_actions set status=$1 where tenant_id=$2 and status='PENDING' returning id",
        [state, tenant],
      );
    expect((await claim("b", "EXECUTING")).rows).toHaveLength(0);
    const results = await Promise.all([claim("a", "EXECUTING"), claim("a", "REJECTING")]);
    expect(results.map((r) => r.rows.length).sort()).toEqual([0, 1]);
    await db.exec("update pending_agent_actions set status='EXECUTION_UNCERTAIN'");
    expect((await claim("a", "EXECUTING")).rows).toHaveLength(0);
  } finally {
    await db.close();
  }
}, 30000);
