import { z } from "zod";

/**
 * `GET /api/v1/leads/analytics?days=` query — the `/jessy/analytics` period selector (MENU
 * RESTRUCTURE FINAL). `days` is a simple lookback window (7/14/30), not a `from`/`to` range —
 * matches the spec mockup's "Last 7 days ▾" dropdown.
 */
export const GetLeadsAnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

export type GetLeadsAnalyticsQueryDto = z.infer<typeof GetLeadsAnalyticsQuerySchema>;

/** One day's point for the "Total Contacts"/"New Contacts" charts. */
export interface LeadsAnalyticsDailyPointDto {
  /** `YYYY-MM-DD`, UTC. */
  readonly date: string;
  /** Leads created on this day. */
  readonly newContacts: number;
  /** Running total of every lead ever created, up to and including this day. */
  readonly totalContacts: number;
}

/**
 * `GET /api/v1/leads/analytics` response — real KPIs computed from `@aos/lead-store`'s real
 * `leads`/`conversations`/`messages` data (MENU RESTRUCTURE FINAL `/jessy/analytics`, never
 * client-side math over incomplete data). See `LeadsService.getAnalytics`'s docstring for the
 * exact formula behind each field.
 */
export interface LeadsAnalyticsResponseDto {
  readonly periodDays: number;
  /** Every lead that has exchanged at least one real WhatsApp message (`firstMessageAt` set). */
  readonly totalContacts: number;
  /** Leads created within the selected period. */
  readonly newContacts: number;
  /** Leads with a message in the last 24 hours. */
  readonly active: number;
  /**
   * Average minutes between every real INCOMING message and the next real OUTGOING reply, across
   * every conversation with activity in the selected period. `null` when no such gap exists yet
   * (never a fabricated `0`).
   */
  readonly avgResponseTimeMinutes: number | null;
  /** Average minutes between a conversation's very first INCOMING message and its first real reply. `null` when no conversation in the period has both yet. */
  readonly avgFirstResponseTimeMinutes: number | null;
  readonly dailySeries: readonly LeadsAnalyticsDailyPointDto[];
}
