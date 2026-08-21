import { z } from "zod";

import {
  SUPPORTED_CALENDAR_EVENT_TYPES,
  type StoredCalendarEvent,
} from "../domain/calendar-event.js";

/** Only the 5 supported types are ever accepted from a client — coordinator note section 1. */
const CalendarEventTypeSchema = z.enum(SUPPORTED_CALENDAR_EVENT_TYPES);
const RecurrenceSchema = z.enum(["ONCE", "DAILY", "WEEKLY", "MONTHLY", "INTERVAL_HOURS"]);

/** `GET /api/v1/calendar?range=this_week` or `?month=YYYY-MM`. Exactly one of the two must be supplied. */
export const GetCalendarQuerySchema = z
  .object({
    range: z.literal("this_week").optional(),
    month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be formatted YYYY-MM")
      .optional(),
  })
  .refine((value) => value.range !== undefined || value.month !== undefined, {
    message: "Either 'range=this_week' or 'month=YYYY-MM' must be supplied",
  });
export type GetCalendarQueryDto = z.infer<typeof GetCalendarQuerySchema>;

/** `POST /api/v1/calendar` body — the "Tambah Jadwal" modal's payload. */
export const CreateCalendarEventBodySchema = z
  .object({
    eventType: CalendarEventTypeSchema,
    title: z.string().min(1),
    description: z.string().min(1).optional(),
    scheduledAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
    recurrence: RecurrenceSchema,
    recurrenceDays: z.array(z.number().int().min(1).max(7)).min(1).optional(),
    recurrenceTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "recurrenceTime must be formatted HH:mm")
      .optional(),
    recurrenceIntervalHours: z.number().int().min(1).max(23).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    targetId: z.string().min(1).optional(),
    targetName: z.string().min(1).optional(),
  })
  .refine((value) => value.recurrence !== "WEEKLY" || value.recurrenceDays !== undefined, {
    message: "recurrenceDays is required when recurrence is WEEKLY",
    path: ["recurrenceDays"],
  })
  .refine(
    (value) => value.recurrence !== "INTERVAL_HOURS" || value.recurrenceIntervalHours !== undefined,
    {
      message: "recurrenceIntervalHours is required when recurrence is INTERVAL_HOURS",
      path: ["recurrenceIntervalHours"],
    },
  );
export type CreateCalendarEventBodyDto = z.infer<typeof CreateCalendarEventBodySchema>;

/** `PUT /api/v1/calendar/:id` body — every field optional, only supplied fields are patched. */
export const UpdateCalendarEventBodySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  scheduledAt: z.string().datetime({ offset: true }).or(z.string().datetime()).optional(),
  recurrence: RecurrenceSchema.optional(),
  recurrenceDays: z.array(z.number().int().min(1).max(7)).min(1).optional(),
  recurrenceTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "recurrenceTime must be formatted HH:mm")
    .optional(),
  recurrenceIntervalHours: z.number().int().min(1).max(23).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateCalendarEventBodyDto = z.infer<typeof UpdateCalendarEventBodySchema>;

export interface CalendarEventResponseDto {
  readonly id: string;
  readonly eventType: string;
  readonly title: string;
  readonly description?: string;
  readonly scheduledAt: string;
  readonly timezone: string;
  readonly recurrence: string;
  readonly recurrenceDays?: readonly number[];
  readonly recurrenceTime?: string;
  readonly recurrenceIntervalHours?: number;
  readonly status: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
  readonly targetId?: string;
  readonly targetName?: string;
  readonly metadata?: Record<string, unknown>;
  readonly result?: Record<string, unknown>;
  readonly errorMessage?: string;
  readonly createdBy: string;
  readonly createdAt: string;
}

export function toCalendarEventResponseDto(event: StoredCalendarEvent): CalendarEventResponseDto {
  return {
    id: event.id,
    eventType: event.eventType,
    title: event.title,
    ...(event.description !== undefined ? { description: event.description } : {}),
    scheduledAt: event.scheduledAt,
    timezone: event.timezone,
    recurrence: event.recurrence,
    ...(event.recurrenceDays !== undefined ? { recurrenceDays: event.recurrenceDays } : {}),
    ...(event.recurrenceTime !== undefined ? { recurrenceTime: event.recurrenceTime } : {}),
    ...(event.recurrenceIntervalHours !== undefined
      ? { recurrenceIntervalHours: event.recurrenceIntervalHours }
      : {}),
    status: event.status,
    ...(event.startedAt !== undefined ? { startedAt: event.startedAt } : {}),
    ...(event.completedAt !== undefined ? { completedAt: event.completedAt } : {}),
    ...(event.durationMs !== undefined ? { durationMs: event.durationMs } : {}),
    ...(event.targetId !== undefined ? { targetId: event.targetId } : {}),
    ...(event.targetName !== undefined ? { targetName: event.targetName } : {}),
    ...(event.metadata !== undefined ? { metadata: event.metadata } : {}),
    ...(event.result !== undefined ? { result: event.result } : {}),
    ...(event.errorMessage !== undefined ? { errorMessage: event.errorMessage } : {}),
    createdBy: event.createdBy,
    createdAt: event.createdAt,
  };
}
