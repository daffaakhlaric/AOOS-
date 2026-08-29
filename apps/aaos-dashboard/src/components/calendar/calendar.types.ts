/**
 * Shared constants for the "Kalender Aktivitas" widget (AAOS-KALENDER-AKTIVITAS). Only the event
 * types `aaos-api`'s `SchedulerService.executeEvent` actually implements are listed here — see
 * `docs/PROMPT-AAOS-KALENDER-AKTIVITAS.md`'s COORDINATOR NOTE section 1 for the full list of
 * originally-excluded types (6 campaign-mutating types with no human-approval gate at execution
 * time, plus 3 with zero real backing anywhere in this codebase). `RECYCLING_RUN` was added by
 * AAOS-LEAD-RECYCLING-BROADCAST (coordinator note section 7) alongside the original 5.
 */
export const SUPPORTED_CALENDAR_EVENT_TYPES = [
  "SCRAPER_RUN",
  "SAMANTHA_PULL_DATA",
  "SAMANTHA_ANALYZE",
  "KAI_REFRESH_CHECK",
  "DAILY_DIGEST",
  "RECYCLING_RUN",
] as const;

export type CalendarEventType = (typeof SUPPORTED_CALENDAR_EVENT_TYPES)[number];

export interface CalendarEventTypeOption {
  readonly value: CalendarEventType;
  readonly label: string;
}

export interface CalendarEventTypeGroup {
  readonly group: string;
  readonly items: readonly CalendarEventTypeOption[];
}

/** "Tambah Jadwal" dropdown groups — dropping the spec's Campaign/Kai-generate/unsupported-monitoring groups (coordinator note section 1). */
export const CALENDAR_EVENT_TYPE_OPTIONS: readonly CalendarEventTypeGroup[] = [
  {
    group: "Samantha",
    items: [
      { value: "SAMANTHA_ANALYZE", label: "🤖 Samantha Analisa Campaign" },
      { value: "SAMANTHA_PULL_DATA", label: "📊 Tarik Data Meta Ads" },
      { value: "DAILY_DIGEST", label: "📋 Daily Digest" },
    ],
  },
  {
    group: "Kai",
    items: [{ value: "KAI_REFRESH_CHECK", label: "🔍 Kai Refresh Check" }],
  },
  {
    group: "Operasional",
    items: [{ value: "SCRAPER_RUN", label: "📸 Scrape Foto Mobix" }],
  },
  {
    group: "Clara",
    items: [{ value: "RECYCLING_RUN", label: "♻️ Auto Recycling Broadcast" }],
  },
];

export const EVENT_TYPE_LABEL: Readonly<Record<CalendarEventType, string>> = Object.fromEntries(
  CALENDAR_EVENT_TYPE_OPTIONS.flatMap((g) => g.items).map((item) => [item.value, item.label]),
) as Readonly<Record<CalendarEventType, string>>;

export const EVENT_ICON: Readonly<Record<CalendarEventType, string>> = {
  SAMANTHA_ANALYZE: "🤖",
  SAMANTHA_PULL_DATA: "📊",
  DAILY_DIGEST: "📋",
  KAI_REFRESH_CHECK: "🔍",
  SCRAPER_RUN: "📸",
  RECYCLING_RUN: "♻️",
};

export const STATUS_ICON: Readonly<Record<string, string>> = {
  PENDING: "⏳",
  RUNNING: "🔄",
  DONE: "✅",
  FAILED: "❌",
  SKIPPED: "⏸",
};

export const TIME_PRESETS = ["06:00", "08:00", "12:00", "16:00", "21:00"] as const;

/** Sen..Min, ISO weekday order (1..7) — matches `aaos-api`'s `recurrenceDays` convention. */
export const DAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"] as const;

export type CalendarRecurrence = "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";

export const RECURRENCE_LABEL: Readonly<Record<CalendarRecurrence, string>> = {
  ONCE: "Sekali",
  DAILY: "Harian",
  WEEKLY: "Mingguan",
  MONTHLY: "Bulanan",
};
