import type { RealtimeChannel } from "@supabase/supabase-js";

import { createSupabaseBrowserClient } from "./supabase";
import type {
  ActivityDto,
  ActivityToolCallDto,
  MessageDto,
  ScoringEventDto,
} from "@/types/dashboard.types";

/**
 * AAOS-CHAT-ROOM-CLARA — this app's FIRST direct-Supabase-Realtime subscription (its `lib/
 * supabase.ts`'s `createSupabaseBrowserClient()` was, until now, used only for the auth session —
 * see that file's own docstring on "the one exception to this app's proxy-everything-through-
 * aaos-api architecture"). This makes Realtime the SECOND such exception, per coordinator note #3
 * — reusing the SAME browser client, not a second one.
 *
 * `messages`/`scoring_events` INSERTs still originate server-side (`aaos-api`'s webhook path /
 * `POST /leads/:id/message` / `POST /leads/:id/intervene`) — this is a read-side push
 * notification of a write that already happened through the normal path, never a new write path.
 *
 * RLS: a MANAGER has no `sales_humans` row (the existing `sales_view_own_branch_*` policies in
 * `002_rls_policies.sql` scope by `sales_humans.branch_id`, which a manager never has), so this
 * subscription relies on the additive `manager_view_all_messages`/`manager_view_all_scoring_events`
 * policies in `004_message_sender.sql` (keyed off `auth.jwt() -> 'user_metadata' ->> 'role'`,
 * matching `lib/auth.ts`'s own `UserRole` convention) — without them, a manager's browser
 * subscription silently receives nothing for any branch it isn't also a `sales_humans` member of.
 */
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

/** Subscribes to live `messages`/`scoring_events` INSERTs for ONE lead's chat room — mirrors `apps/aaos-crm`'s `lib/realtime.ts` `subscribeToLeadChat` exactly (same real tables, same filter). */
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

/**
 * AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase B — the Activity Log page's realtime feed. Same real
 * `postgres_changes` mechanism as `subscribeToLeadChat` above (this file's class doc), reusing the
 * same browser client. `aaos-api`'s `ActivityLogger.start` performs a plain `.insert(...)` into
 * `agent_activities` (`021_agent_activities.sql`) — this subscription is a read-side push
 * notification of that real write, never a manually-sent broadcast payload (the pasted spec's own
 * mockup used `supabase.channel(...).send({ type: "broadcast", ... })`, corrected before this
 * agent started — see that migration's own header doc).
 *
 * RLS: `021_agent_activities.sql`'s `manager_view_own_tenant_activities` policy is what lets a
 * manager's browser client receive INSERTs for their own tenant's rows — without it this
 * subscription silently receives nothing (same failure mode `subscribeToLeadChat`'s own doc warns
 * about for `messages`/`scoring_events`).
 */
export interface RealtimeActivityToolCallEntry {
  readonly tool: string;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly at: string;
}

export interface RealtimeActivityRow {
  readonly id: string;
  readonly loop_id: string | null;
  readonly agent: string;
  readonly action_type: string;
  readonly mode: string;
  readonly status: string;
  readonly input: unknown;
  readonly output: unknown;
  readonly dev_preview: unknown;
  readonly reasoning: string | null;
  readonly tool_calls: readonly RealtimeActivityToolCallEntry[] | null;
  readonly started_at: string;
  readonly completed_at: string | null;
  readonly duration_ms: number | null;
  readonly error_message: string | null;
  readonly error_stack: string | null;
  readonly created_at: string;
}

function toToolCallDto(entry: RealtimeActivityToolCallEntry): ActivityToolCallDto {
  return { tool: entry.tool, input: entry.input, output: entry.output, at: entry.at };
}

export function toActivityDtoFromRealtimeRow(row: RealtimeActivityRow): ActivityDto {
  return {
    id: row.id,
    loopId: row.loop_id ?? undefined,
    agent: row.agent,
    actionType: row.action_type,
    mode: row.mode,
    status: row.status,
    input: row.input ?? undefined,
    output: row.output ?? undefined,
    devPreview: row.dev_preview ?? undefined,
    reasoning: row.reasoning ?? undefined,
    toolCalls: (row.tool_calls ?? []).map(toToolCallDto),
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    errorMessage: row.error_message ?? undefined,
    errorStack: row.error_stack ?? undefined,
    createdAt: row.created_at,
  };
}

export interface ActivityLogSubscriptionHandlers {
  readonly onNewActivity: (activity: ActivityDto) => void;
  readonly onActivityUpdated: (activity: ActivityDto) => void;
}

/**
 * Subscribes to live `agent_activities` INSERT (new `RUNNING` row) and UPDATE (a real
 * `ActivityLogger.complete`/`.fail` terminal write landing) events, scoped to one tenant —
 * `tenantId=eq.${tenantId}` mirrors `subscribeToLeadChat`'s own `lead_id=eq.${leadId}` filter
 * shape.
 */
export function subscribeToActivityLog(
  tenantId: string,
  handlers: ActivityLogSubscriptionHandlers,
): RealtimeChannel {
  const supabase = createSupabaseBrowserClient();
  return supabase
    .channel(`activity-log-${tenantId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "agent_activities",
        filter: `tenant_id=eq.${tenantId}`,
      },
      (payload) => {
        handlers.onNewActivity(toActivityDtoFromRealtimeRow(payload.new as RealtimeActivityRow));
      },
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "agent_activities",
        filter: `tenant_id=eq.${tenantId}`,
      },
      (payload) => {
        handlers.onActivityUpdated(
          toActivityDtoFromRealtimeRow(payload.new as RealtimeActivityRow),
        );
      },
    )
    .subscribe();
}
