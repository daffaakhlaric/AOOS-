/**
 * A follow-up schedule day offset. The spec's folder-tree comment says `D3 | D7 | D14`, but its
 * own `FOLLOW_UP_SCHEDULE` table (spec "Follow-up Schedule") schedules a WARM lead's first
 * follow-up at day 1 (`FOLLOW_UP_WARM_D1`) — a real 4th value the folder comment omits. `D1` is
 * added here so `FollowUpScheduleBuilder` can represent that WARM-lead entry without an
 * out-of-enum magic number; documented as a design resolution alongside the 6 the spec calls out
 * explicitly.
 */
export enum FollowUpDay {
  D1 = 1,
  D3 = 3,
  D7 = 7,
  D14 = 14,
}
