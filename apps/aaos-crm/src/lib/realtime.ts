import type { RealtimeChannel } from "@supabase/supabase-js";

import { createSupabaseBrowserClient } from "./supabase";
import type { LeadDto, MessageDto, ScoringEventDto } from "@/types/crm.types";

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

/** Raw `postgres_changes` `messages` row shape — snake_case, matching `@aos/lead-store`'s real `messages` table columns (`MessageMapper`'s `MessageRow` + AAOS-CHAT-ROOM-CLARA's `sender_type`/`sender_name`). */
export interface RealtimeMessageRow {
  readonly id: string;
  readonly conversation_id: string;
  readonly lead_id: string;
  readonly direction: string;
  readonly message_type: string;
  readonly body: string | null;
  readonly sent_at: string | null;
  readonly created_at: string;
  readonly sender_type: string | null;
  readonly sender_name: string | null;
}

export function toMessageDtoFromRealtimeRow(row: RealtimeMessageRow): MessageDto {
  return {
    id: row.id,
    direction: row.direction,
    messageType: row.message_type,
    body: row.body ?? undefined,
    sentAt: row.sent_at ?? undefined,
    createdAt: row.created_at,
    senderType: row.sender_type ?? undefined,
    senderName: row.sender_name ?? undefined,
  };
}

/** Raw `postgres_changes` `scoring_events` row shape — matching `@aos/lead-store`'s real `scoring_events` table columns. */
export interface RealtimeScoringEventRow {
  readonly id: string;
  readonly lead_id: string;
  readonly score_before: number;
  readonly score_after: number;
  readonly delta: number;
  readonly reason: string;
  readonly triggered_by: string | null;
  readonly created_at: string;
}

export function toScoringEventDtoFromRealtimeRow(row: RealtimeScoringEventRow): ScoringEventDto {
  return {
    id: row.id,
    leadId: row.lead_id,
    scoreBefore: row.score_before,
    scoreAfter: row.score_after,
    delta: row.delta,
    reason: row.reason,
    triggeredBy: row.triggered_by ?? undefined,
    createdAt: row.created_at,
  };
}

export interface LeadChatSubscriptionHandlers {
  readonly onNewMessage: (message: MessageDto) => void;
  readonly onNewScoringEvent: (event: ScoringEventDto) => void;
}

/**
 * Subscribes to live `messages`/`scoring_events` INSERTs for ONE lead's chat room — this app's
 * SECOND direct-Supabase-Realtime exception (the first is `subscribeToHotLeads` above), per
 * AAOS-CHAT-ROOM-CLARA coordinator note #3: `messages`/`scoring_events` writes still originate
 * server-side (`aaos-api`'s webhook path / `POST /leads/:id/message`); this is a read-side push
 * notification of a write that already happened, not a new write path. RLS scopes a sales human's
 * subscription to their own branch (`002_rls_policies.sql`'s existing `sales_view_own_branch_*`
 * policies — Realtime runs under the same RLS as a normal `SELECT`), which is exactly the scope a
 * CRM sales human's own lead already sits within.
 */
export function subscribeToLeadChat(
  leadId: string,
  handlers: LeadChatSubscriptionHandlers,
): RealtimeChannel {
  const supabase = createSupabaseBrowserClient();
  return supabase
    .channel(`lead-chat-${leadId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `lead_id=eq.${leadId}` },
      (payload) => {
        handlers.onNewMessage(toMessageDtoFromRealtimeRow(payload.new as RealtimeMessageRow));
      },
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "scoring_events",
        filter: `lead_id=eq.${leadId}`,
      },
      (payload) => {
        handlers.onNewScoringEvent(
          toScoringEventDtoFromRealtimeRow(payload.new as RealtimeScoringEventRow),
        );
      },
    )
    .subscribe();
}
