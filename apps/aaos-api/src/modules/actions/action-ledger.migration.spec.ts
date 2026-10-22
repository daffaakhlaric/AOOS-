import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("keeps immutable tenant-scoped commands, single claims, and non-replayable uncertain steps", async () => {
  const db = new PGlite();
  const id = "00000000-0000-4000-8000-000000000001";
  const pending = "00000000-0000-4000-8000-000000000002";
  const sql = readFileSync(
    new URL("../../../supabase/migrations/075_action_execution_ledger.sql", import.meta.url),
    "utf8",
  );
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE pending_agent_actions(id uuid PRIMARY KEY, tenant_id text NOT NULL);
      INSERT INTO pending_agent_actions VALUES ('${pending}', 'a');`);
    await db.exec(sql);
    await db.exec(sql);
    await db.query(
      `INSERT INTO action_executions(id,tenant_id,pending_action_id,revision,command,command_hash)
      VALUES ($1,'a',$2,1,$3,$4)`,
      [id, pending, { actionId: id, tenantId: "a", revision: 1 }, "a".repeat(64)],
    );
    await expect(
      db.query("UPDATE action_executions SET command='{}' WHERE id=$1", [id]),
    ).rejects.toThrow("IMMUTABLE_ACTION_COMMAND");
    await expect(
      db.query("UPDATE action_executions SET state='APPROVED' WHERE id=$1", [id]),
    ).rejects.toThrow("APPROVAL_REQUIRED");
    await db.query(
      "UPDATE action_executions SET state='APPROVED', approved_by='owner', approved_at=now(), approval_hash=command_hash WHERE id=$1",
      [id],
    );
    const claim = (tenant: string) =>
      db.query(
        "UPDATE action_executions SET state='CLAIMED',claim_token=gen_random_uuid() WHERE tenant_id=$1 AND id=$2 AND state='APPROVED' RETURNING id",
        [tenant, id],
      );
    expect((await claim("b")).rows).toHaveLength(0);
    const claims = await Promise.all([claim("a"), claim("a")]);
    expect(claims.map((c) => c.rows.length).sort()).toEqual([0, 1]);
    await expect(
      db.query(
        "INSERT INTO action_steps(tenant_id,action_id,step_key,ordinal,intent) VALUES ('b',$1,'create',0,'{}')",
        [id],
      ),
    ).rejects.toThrow();
    await db.query(
      "INSERT INTO action_steps(tenant_id,action_id,step_key,ordinal,intent) VALUES ('a',$1,'create',0,'{}')",
      [id],
    );
    await db.query("UPDATE action_steps SET state='SUBMITTING' WHERE action_id=$1", [id]);
    await expect(
      db.query("UPDATE action_steps SET state='PENDING' WHERE action_id=$1", [id]),
    ).rejects.toThrow("UNSAFE_STEP_REPLAY");
    await db.query(
      "UPDATE action_steps SET state='UNCERTAIN',provider_object_id='meta-1' WHERE action_id=$1",
      [id],
    );
    await expect(
      db.query("UPDATE action_steps SET provider_object_id='meta-2' WHERE action_id=$1", [id]),
    ).rejects.toThrow("PROVIDER_ID_IMMUTABLE");
    await expect(
      db.query("UPDATE action_steps SET intent='{\"changed\":true}' WHERE action_id=$1", [id]),
    ).rejects.toThrow("IMMUTABLE_STEP_INTENT");
  } finally {
    await db.close();
  }
}, 30000);
