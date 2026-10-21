import type { SupabaseClientLike } from "@aos/lead-store";

import type { StoredCalendarEvent } from "../domain/calendar-event.js";
import {
  LoopTriggerSchema,
  assertLoopTransition,
  type LoopTrigger,
} from "../domain/loop-runtime.js";

import { toDomain, type CalendarEventRow } from "./calendar-event.repository.js";
interface Rpc {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
}
export interface RuntimeClaim {
  id: string;
  correlation_id: string;
  trigger_event_id: string;
  tenant_id: string;
  lease_owner: string;
  event: StoredCalendarEvent;
  trigger_contract: LoopTrigger;
}
/** Same Supabase connection and loop_runs table; no parallel scheduler or event store. */
export class LoopRuntimeRepository {
  constructor(private readonly db: SupabaseClientLike) {}
  private async rpc(name: string, args: Record<string, unknown>) {
    const result = await (this.db as unknown as Rpc).rpc(name, args);
    if (result.error) throw new Error("LOOP_RUNTIME_PERSISTENCE_UNAVAILABLE");
    return result.data;
  }
  async claim(tenant: string, event: string, worker: string): Promise<RuntimeClaim | null> {
    const row = (await this.rpc("claim_advertising_loop", {
      p_tenant: tenant,
      p_event: event,
      p_worker: worker,
    })) as (Omit<RuntimeClaim, "event"> & { event: CalendarEventRow }) | null;
    if (!row) return null;
    const trigger = LoopTriggerSchema.parse(row.trigger_contract);
    if (
      trigger.tenantId !== tenant ||
      trigger.eventId !== event ||
      trigger.correlationId !== row.id
    )
      throw new Error("LOOP_TRIGGER_MISMATCH");
    return { ...row, event: toDomain(row.event), trigger_contract: trigger };
  }
  async heartbeat(claim: RuntimeClaim) {
    return (
      (await this.rpc("heartbeat_advertising_loop", {
        p_tenant: claim.tenant_id,
        p_run: claim.id,
        p_worker: claim.lease_owner,
      })) === true
    );
  }
  async finish(
    claim: RuntimeClaim,
    success: boolean,
    result: unknown,
    error: string | null = null,
    next: string | null = null,
  ) {
    assertLoopTransition("OBSERVING", success ? "COMPLETED" : "FAILED");
    const updated = await this.rpc("finish_advertising_loop", {
      p_tenant: claim.tenant_id,
      p_run: claim.id,
      p_worker: claim.lease_owner,
      p_success: success,
      p_result: result,
      p_error: error,
      p_next: next,
    });
    if (updated !== true) throw new Error("LOOP_LEASE_LOST");
  }
  async reconcile(tenant: string) {
    return this.rpc("reconcile_advertising_loops", { p_tenant: tenant });
  }
}
