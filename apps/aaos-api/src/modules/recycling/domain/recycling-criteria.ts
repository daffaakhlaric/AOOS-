import type { Lead } from "@aos/lead-store";

/**
 * Lead Recycling & Broadcast (AAOS-LEAD-RECYCLING-BROADCAST) eligibility rules — a direct,
 * literal port of the spec's `RECYCLING_CRITERIA` object. `scoreBelow` is intentionally
 * vertical-agnostic (coordinator note section 6: PROPERTY's 65 == AUTOMOTIVE's default 65).
 */
export const RECYCLING_CRITERIA = {
  eligibleStatuses: ["COLD", "WARM"] as const,
  scoreBelow: 65,
  maxBroadcastCount: 3,
  cooldownDays: {
    WARM: 3,
    COLD: 7,
  },
  minAgeDays: 1,
  sendHours: { from: 8, to: 20 },
} as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** WIB = UTC+7, no DST — a fixed offset is exact, not an approximation. */
function wibHour(date: Date): number {
  return (date.getUTCHours() + 7) % 24;
}

function daysSince(from: Date, now: Date): number {
  return (now.getTime() - from.getTime()) / MS_PER_DAY;
}

/**
 * A lead belongs in the Recycling Pool (TAB 1's full list, independent of whether it's currently
 * within its send-hour window or cooldown) — `eligibleStatuses`/`scoreBelow`/`maxBroadcastCount`/
 * `minAgeDays`, never archived. Cooldown/business-hours are `isReadyToSend`'s concern, not this
 * one — a lead can be "in the pool" but not "ready to send" (e.g. mid-cooldown).
 */
export function isInRecyclingPool(lead: Lead, now: Date): boolean {
  if (lead.recyclingArchived) {
    return false;
  }
  if (!(RECYCLING_CRITERIA.eligibleStatuses as readonly string[]).includes(lead.status)) {
    return false;
  }
  if (lead.score >= RECYCLING_CRITERIA.scoreBelow) {
    return false;
  }
  if (lead.broadcastCount >= RECYCLING_CRITERIA.maxBroadcastCount) {
    return false;
  }
  if (daysSince(lead.createdAt, now) < RECYCLING_CRITERIA.minAgeDays) {
    return false;
  }
  return true;
}

/**
 * A pool lead that can ACTUALLY be sent a broadcast right now — `isInRecyclingPool` plus the
 * send-hours window (08:00-20:00 WIB) and the per-status cooldown since `lastBroadcastAt` (a lead
 * never yet broadcast to has no cooldown to wait out).
 */
export function isReadyToSend(lead: Lead, now: Date): boolean {
  if (!isInRecyclingPool(lead, now)) {
    return false;
  }
  const hour = wibHour(now);
  if (hour < RECYCLING_CRITERIA.sendHours.from || hour >= RECYCLING_CRITERIA.sendHours.to) {
    return false;
  }
  if (lead.lastBroadcastAt !== undefined) {
    const cooldownDays =
      lead.status === "WARM"
        ? RECYCLING_CRITERIA.cooldownDays.WARM
        : RECYCLING_CRITERIA.cooldownDays.COLD;
    if (daysSince(lead.lastBroadcastAt, now) < cooldownDays) {
      return false;
    }
  }
  return true;
}

/** Whether a JUST-incremented `broadcastCount` should archive the lead (max-broadcast-count-reached) — `RecyclingService.sendBroadcast`'s own explicit archiving decision, per coordinator note section 3. */
export function shouldArchiveAfterBroadcast(newBroadcastCount: number): boolean {
  return newBroadcastCount >= RECYCLING_CRITERIA.maxBroadcastCount;
}
