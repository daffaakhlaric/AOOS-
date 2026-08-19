/**
 * Shared constants for the "Kalender Aktivitas" widget (AAOS-KALENDER-AKTIVITAS). Only the 5
 * event types `aaos-api`'s `SchedulerService.executeEvent` actually implements are listed here —
 * see `docs/PROMPT-AAOS-KALENDER-AKTIVITAS.md`'s COORDINATOR NOTE section 1 for the full list of
 * 9 excluded types (6 campaign-mutating types with no human-approval gate at execution time, plus
 * 3 with zero real backing anywhere in this codebase). None of the 9 appears in "Tambah Jadwal".
 */
export const SUPPORTED_CALENDAR_EVENT_TYPES = [
  "SCRAPER_RUN",
  "TAMARA_PULL_DATA",
  "TAMARA_ANALYZE",
  "KAI_REFRESH_CHECK",
  "DAILY_DIGEST",
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
    group: "Tamara",
    items: [
      { value: "TAMARA_ANALYZE", label: "🤖 Tamara Analisa Campaign" },
      { value: "TAMARA_PULL_DATA", label: "📊 Tarik Data Meta Ads" },
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
];

export const EVENT_TYPE_LABEL: Readonly<Record<CalendarEventType, string>> = Object.fromEntries(
  CALENDAR_EVENT_TYPE_OPTIONS.flatMap((g) => g.items).map((item) => [item.value, item.label]),
) as Readonly<Record<CalendarEventType, string>>;

export const EVENT_ICON: Readonly<Record<CalendarEventType, string>> = {
  TAMARA_ANALYZE: "🤖",
  TAMARA_PULL_DATA: "📊",
  DAILY_DIGEST: "📋",
  KAI_REFRESH_CHECK: "🔍",
  SCRAPER_RUN: "📸",
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
