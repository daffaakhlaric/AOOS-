/** Formats a rupiah amount as e.g. "Rp 26.400.000" — Indonesian thousands grouping, no decimals. */
export function formatIdr(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Compact rupiah for KPI cards, e.g. "Rp 11.7jt" (spec mockup: "Komisi 11.7 jt"). Only compacts at the "jt" (million) / "rb" (thousand) scale the mockups use — below 1,000 falls back to `formatIdr`. */
export function formatIdrCompact(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toFixed(1)}jt`;
  }
  if (abs >= 1_000) {
    return `Rp ${(amount / 1_000).toFixed(0)}rb`;
  }
  return formatIdr(amount);
}

/** Formats a plain number with Indonesian thousands grouping, e.g. "1.286". */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

/** Formats an ISO date/timestamp as an Indonesian short date, e.g. "09 Agu 2026". */
export function formatDateId(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Formats an ISO timestamp as Indonesian relative time, e.g. "14 menit lalu" / "1 jam lalu" (spec mockup: "2 menit lalu"). Falls back to `formatDateId` once older than a day. */
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
