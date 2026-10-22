import { createHash, randomUUID } from "node:crypto";

import type { SupabaseClientLike } from "@aos/lead-store";

import type { ActionCommand, ActionState } from "./action.types.js";

export interface ExecutionRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly command: ActionCommand;
  readonly command_hash: string;
  readonly state: ActionState;
  readonly claim_token: string | null;
  readonly approval_hash: string | null;
  readonly pending_action_id: string | null;
  readonly revision: number;
  readonly approved_by: string | null;
  readonly approved_at: string | null;
  readonly claimed_at: string | null;
  readonly error_code: string | null;
}
export interface StepRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly action_id: string;
  readonly step_key: string;
  readonly ordinal: number;
  readonly intent: Record<string, unknown>;
  readonly state: "PENDING" | "SUBMITTING" | "VERIFYING" | "VERIFIED" | "FAILED" | "UNCERTAIN";
  readonly attempt: number;
  readonly provider_object_id: string | null;
  readonly receipt: Record<string, unknown> | null;
  readonly verification: Record<string, unknown> | null;
  readonly started_at: string | null;
  readonly finished_at: string | null;
  readonly error_code: string | null;
}

/** Sorted JSON makes approval hashes independent of object property insertion order. */
export function commandHash(value: unknown): string {
  const canonical = (v: unknown): string => {
    if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
    if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
    const obj = v as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .filter((k) => obj[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
      .join(",")}}`;
  };
  return createHash("sha256").update(canonical(value)).digest("hex");
}

/** Tenant-scoped CAS writes. No automatic reclaim after an external request may have started. */
export class ActionRepository {
  constructor(private readonly db: SupabaseClientLike) {}

  async list(tenant: string): Promise<readonly ExecutionRow[]> {
    const r = await this.db
      .from<ExecutionRow>("action_executions")
      .select("*")
      .eq("tenant_id", tenant)
      .order("created_at", { ascending: false })
      .limit(50);
    if (r.error) throw new Error("ACTION_READ_FAILED");
    return r.data ?? [];
  }

  async create(command: ActionCommand, pendingActionId: string): Promise<ExecutionRow> {
    if (command.steps.length === 0) throw new Error("EMPTY_EXECUTION_PLAN");
    const r = await this.db
      .from<ExecutionRow>("action_executions")
      .insert({
        id: command.actionId,
        tenant_id: command.tenantId,
        pending_action_id: pendingActionId,
        revision: command.revision,
        command,
        command_hash: commandHash(command),
        state: "AWAITING_APPROVAL",
      })
      .select("*")
      .single();
    if (r.error || !r.data) throw new Error("ACTION_PERSISTENCE_FAILED");
    const steps = await this.db.from<StepRow>("action_steps").insert(
      command.steps.map((step, ordinal) => ({
        tenant_id: command.tenantId,
        action_id: command.actionId,
        step_key: step.key,
        ordinal,
        intent: step.intent,
      })),
    );
    if (steps.error) throw new Error("ACTION_PLAN_PERSISTENCE_FAILED");
    return r.data;
  }

  async find(tenant: string, id: string): Promise<ExecutionRow | null> {
    const r = await this.db
      .from<ExecutionRow>("action_executions")
      .select("*")
      .eq("tenant_id", tenant)
      .eq("id", id)
      .maybeSingle();
    if (r.error) throw new Error("ACTION_READ_FAILED");
    return r.data;
  }

  async approve(tenant: string, id: string, hash: string, actor: string): Promise<boolean> {
    const row = await this.find(tenant, id);
    if (!row || hash !== commandHash(row.command)) throw new Error("APPROVAL_MISMATCH");
    assertStepPlan(row.command, await this.steps(tenant, id));
    const r = await this.db
      .from<ExecutionRow>("action_executions")
      .update({
        state: "APPROVED",
        approved_by: actor,
        approved_at: new Date().toISOString(),
        approval_hash: hash,
      })
      .eq("tenant_id", tenant)
      .eq("id", id)
      .eq("command_hash", hash)
      .eq("state", "AWAITING_APPROVAL")
      .select("*");
    if (r.error) throw new Error("ACTION_APPROVAL_FAILED");
    return r.data?.length === 1;
  }

  async claim(tenant: string, id: string): Promise<string | null> {
    const token = randomUUID();
    const r = await this.db
      .from<ExecutionRow>("action_executions")
      .update({
        state: "CLAIMED",
        claim_token: token,
        claimed_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenant)
      .eq("id", id)
      .eq("state", "APPROVED")
      .select("*");
    if (r.error) throw new Error("ACTION_CLAIM_FAILED");
    return r.data?.length === 1 ? token : null;
  }

  async transition(
    tenant: string,
    id: string,
    token: string,
    from: ActionState,
    to: ActionState,
    errorCode?: string,
  ): Promise<void> {
    const r = await this.db
      .from<ExecutionRow>("action_executions")
      .update({ state: to, error_code: errorCode ?? null })
      .eq("tenant_id", tenant)
      .eq("id", id)
      .eq("claim_token", token)
      .eq("state", from)
      .select("*");
    if (r.error || r.data?.length !== 1) throw new Error("ACTION_TRANSITION_CONFLICT");
  }

  async steps(tenant: string, id: string): Promise<readonly StepRow[]> {
    const r = await this.db
      .from<StepRow>("action_steps")
      .select("*")
      .eq("tenant_id", tenant)
      .eq("action_id", id)
      .order("ordinal", { ascending: true });
    if (r.error) throw new Error("ACTION_STEPS_READ_FAILED");
    return r.data ?? [];
  }

  async beginStep(step: StepRow): Promise<boolean> {
    const r = await this.db
      .from<StepRow>("action_steps")
      .update({
        state: "SUBMITTING",
        attempt: step.attempt + 1,
        started_at: new Date().toISOString(),
      })
      .eq("tenant_id", step.tenant_id)
      .eq("action_id", step.action_id)
      .eq("id", step.id)
      .eq("state", "PENDING")
      .eq("attempt", step.attempt)
      .select("*");
    if (r.error) throw new Error("STEP_CLAIM_FAILED");
    return r.data?.length === 1;
  }

  async recordReceipt(
    step: StepRow,
    receipt: Record<string, unknown>,
    providerId: string,
  ): Promise<void> {
    const r = await this.db
      .from<StepRow>("action_steps")
      .update({ receipt, provider_object_id: providerId })
      .eq("tenant_id", step.tenant_id)
      .eq("action_id", step.action_id)
      .eq("id", step.id)
      .eq("state", "SUBMITTING")
      .select("*");
    if (r.error || r.data?.length !== 1) throw new Error("RECEIPT_PERSISTENCE_FAILED");
  }

  async finishStep(
    step: StepRow,
    from: StepRow["state"],
    state: StepRow["state"],
    values: {
      provider_object_id?: string;
      receipt?: Record<string, unknown>;
      verification?: Record<string, unknown>;
      error_code?: string;
    } = {},
  ): Promise<void> {
    const r = await this.db
      .from<StepRow>("action_steps")
      .update({
        ...values,
        state,
        ...(state === "VERIFIED" ? { finished_at: new Date().toISOString() } : {}),
      })
      .eq("tenant_id", step.tenant_id)
      .eq("action_id", step.action_id)
      .eq("id", step.id)
      .eq("state", from)
      .select("*");
    if (r.error || r.data?.length !== 1) throw new Error("STEP_TRANSITION_CONFLICT");
  }
}

export function assertStepPlan(command: ActionCommand, rows: readonly StepRow[]): void {
  if (
    !command.steps?.length ||
    command.steps.length !== rows.length ||
    new Set(command.steps.map((s) => s.key)).size !== command.steps.length ||
    rows.some(
      (row, index) =>
        row.ordinal !== index ||
        row.action_id !== command.actionId ||
        row.tenant_id !== command.tenantId ||
        row.step_key !== command.steps[index]?.key ||
        commandHash(row.intent) !== commandHash(command.steps[index]?.intent),
    )
  )
    throw new Error("FROZEN_STEP_PLAN_MISMATCH");
}
