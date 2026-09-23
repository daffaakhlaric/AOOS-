/** Re-implemented from apps/eyvra-dashboard/src/lib/formatters.ts (same real formatting rules) — kept to only the subset Command Center needs. */

export function formatIdr(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Compact rupiah for KPI cards, e.g. "Rp 184,2 jt". */
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
    return `Rp ${decimal(amount / 1_000)} rb`;
  }
  return formatIdr(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function formatDateId(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatRelativeTimeId(iso: string, now: Date = new Date()): string {
  const MINUTE_MS = 60_000;
  const HOUR_MS = 60 * MINUTE_MS;
  const DAY_MS = 24 * HOUR_MS;
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

/** "14 Agu 09:49 WIB" — used for the Topbar's last-sync time. */
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
