import type { RealtimeChannel } from "@supabase/supabase-js";

import { createSupabaseBrowserClient } from "./supabase";
import type { LeadDto } from "@/types/crm.types";

/**
 * Coordinator note #1's one deliberate exception: subscribes directly to Supabase Realtime from
 * the browser (RLS enforces row-level access control client-side; no `aaos-api` proxy is needed
 * or possible for a live subscription) — exactly as the spec's own `lib/realtime.ts` pseudocode
 * shows. Everything else in this app proxies through `aaos-api`.
 */

/** The raw `postgres_changes` payload row shape — snake_case, matching `@aos/lead-store`'s real `leads` table columns (`LeadMapper`'s `LeadRow`). Kept separate from `LeadDto` (camelCase, from `aaos-api`) since Realtime delivers the DB row shape directly, unmapped. */
export interface RealtimeLeadRow {
  readonly id: string;
  readonly lead_phone: string;
  readonly lead_name: string | null;
  readonly branch_id: string;
  readonly status: string;
  readonly temperature: string;
  readonly score: number;
  readonly qual_budget: boolean;
  readonly qual_unit: boolean;
  readonly qual_area: boolean;
  readonly qual_payment: boolean;
  readonly qual_timeline: boolean;
  readonly qual_name: boolean;
  readonly assigned_sales_id: string | null;
  readonly assigned_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Maps a raw Realtime row to the same `LeadDto` shape `GET /api/leads` returns, so `HotLeadInbox` renders both sources identically. */
export function toLeadDtoFromRealtimeRow(row: RealtimeLeadRow): LeadDto {
  return {
    id: row.id,
    leadPhone: row.lead_phone,
    leadName: row.lead_name ?? undefined,
    branchId: row.branch_id,
    status: row.status,
    temperature: row.temperature,
    score: row.score,
    qualification: {
      budget: row.qual_budget,
      unit: row.qual_unit,
      area: row.qual_area,
      payment: row.qual_payment,
      timeline: row.qual_timeline,
      name: row.qual_name,
    },
    assignedSalesId: row.assigned_sales_id ?? undefined,
    assignedAt: row.assigned_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface HotLeadsSubscriptionHandlers {
  readonly onNewLead: (lead: LeadDto) => void;
  readonly onLeadClaimed: (leadId: string) => void;
}

/**
 * Subscribes to new/claimed hot leads for one branch (spec "Supabase Realtime Setup"). Returns
 * the raw `RealtimeChannel` so the caller can `.unsubscribe()` it on unmount.
 */
export function subscribeToHotLeads(
  branchId: string,
  handlers: HotLeadsSubscriptionHandlers,
): RealtimeChannel {
  const supabase = createSupabaseBrowserClient();
  return supabase
    .channel(`hot-leads-${branchId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "leads", filter: `branch_id=eq.${branchId}` },
      (payload) => {
        const row = payload.new as RealtimeLeadRow;
        if (row.status === "HOT") {
          handlers.onNewLead(toLeadDtoFromRealtimeRow(row));
        }
      },
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "leads", filter: `branch_id=eq.${branchId}` },
      (payload) => {
        const row = payload.new as RealtimeLeadRow;
        if (row.assigned_sales_id !== null) {
          handlers.onLeadClaimed(row.id);
        }
      },
    )
    .subscribe();
}
