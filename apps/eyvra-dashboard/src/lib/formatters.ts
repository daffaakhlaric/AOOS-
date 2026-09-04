/** Formats a rupiah amount as e.g. "Rp 26.400.000" — Indonesian thousands grouping, no decimals. */
export function formatIdr(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Compact rupiah for KPI cards/strips, e.g. "Rp 184,2 jt" (FINAL UI REBUILD reference screenshot's
 * KPI strip: "BELANJA Rp 184,2 jt") — Indonesian decimal comma, space before the unit suffix.
 * Scales: "M" (miliar, ≥1B), "jt" (juta, ≥1M), "rb" (ribu, ≥1K); below 1,000 falls back to
 * `formatIdr`. Previously emitted a bare-period decimal ("Rp 26.4jt") which isn't valid Indonesian
 * grouping — corrected in place rather than duplicated into a second formatter, since every caller
 * wants the same compact KPI-cell shape and none asserted the old exact string in a test.
 */
export function formatIdrCompact(amount: number): string {
  const abs = Math.abs(amount);
  const decimal = (value: number): string => value.toFixed(1).replace(".", ",");
  if (abs >= 1_000_000_000) {
    return `Rp ${decimal(amount / 1_000_000_000)} M`;
  }
  if (abs >= 1_000_000) {
    return `Rp ${decimal(amount / 1_000_000)} jt`;
  }
  if (abs >= 1_000) {
    return `Rp ${(amount / 1_000).toFixed(0)} rb`;
  }
  return formatIdr(amount);
}

/** Formats a plain number with Indonesian thousands grouping, e.g. "1.286". */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

/** Formats a fraction (0-1) as a percentage, e.g. 0.94 -> "94%". */
export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** Formats a `Date` as a full Indonesian month + year, e.g. "Agustus 2026" (Overview page's "Ringkasan operasional ... · {bulan} {tahun}" subtitle, FINAL UI REBUILD reference screenshot). */
export function formatMonthYearId(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(date);
}

/** Formats an ISO date/timestamp as an Indonesian short date, e.g. "09 Agu 2026". */
export function formatDateId(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/** Formats an ISO timestamp as "14 Agu 09:49 WIB" — day/month/time in Asia/Jakarta (WIB, UTC+7), e.g. for "meta-ads/page.tsx"'s "Data diambil: ..." (MAAO2 redesign). */
export function formatDateTimeIdWib(iso: string): string {
  const parts = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("hour")}:${get("minute")} WIB`;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Formats an ISO timestamp as Indonesian relative time, e.g. "14 menit lalu" / "1 jam lalu" (spec mockup: "Recent Hot Leads"). Falls back to `formatDateId` once older than a day. */
export function formatRelativeTimeId(iso: string, now: Date = new Date()): string {
  const deltaMs = now.getTime() - new Date(iso).getTime();
  if (deltaMs < MINUTE_MS) {
    return "baru saja";
  }
  if (deltaMs < HOUR_MS) {
    return `${Math.floor(deltaMs / MINUTE_MS)} menit lalu`;
  }
  if (deltaMs < DAY_MS) {
    return `${Math.floor(deltaMs / HOUR_MS)} jam lalu`;
  }
  return formatDateId(iso);
}
