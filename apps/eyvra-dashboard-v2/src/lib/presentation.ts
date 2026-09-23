/** Presentation only: never infer an action, confidence, or missing measurement. */
export function getMetricDeltaIntent(
  metric: string | undefined,
  delta: number,
): "good" | "bad" | "neutral" {
  if (!Number.isFinite(delta) || delta === 0) return "neutral";
  if (["cpl", "cpql", "cpc", "frequency"].includes(metric ?? "")) return delta > 0 ? "bad" : "good";
  if (["ctr", "leads", "qualifiedLeads", "bookings"].includes(metric ?? ""))
    return delta > 0 ? "good" : "bad";
  return "neutral";
}

const labels: Record<string, string> = {
  CREATIVE_FATIGUE: "Creative fatigue",
  CTR_DROP: "CTR decreased",
  CTR_IMPROVEMENT: "CTR improved",
  CPL_SPIKE: "Cost per lead increased",
  CPL_IMPROVEMENT: "Cost per lead improved",
  FREQUENCY_RISE: "Frequency increased",
  SPEND_WITHOUT_RESULT: "Spend without results",
  INSUFFICIENT_DATA: "Insufficient data",
  EXECUTE_VERDICT: "Applied campaign decision",
  CREATIVE_REFRESH_REQUIRED: "Creative refresh requested",
  REQUEST_KAI_CREATIVE: "Request new creatives",
  NO_ACTION: "No action needed",
  MONITOR: "Monitor performance",
  SCALE: "Scale campaign",
  KEEP: "Keep running",
  REVIEW: "Review campaign",
  REFRESH: "Refresh creatives",
  FIX: "Resolve campaign issues",
  PAUSE: "Pause campaign",
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  OFF_TRACK: "Off track",
  AUTOPILOT_GUARDED: "Guarded Autopilot",
  ADVISOR: "Advisor",
  COPILOT: "Copilot",
  AUTONOMOUS: "Autonomous",
  UNKNOWN: "Unavailable",
  HEALTHY: "Healthy",
  WATCH: "Watch",
  WARNING: "Warning",
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  SIMULATED: "Simulation",
};

/**
 * Real metric/domain acronyms that must stay upper-case. Without this, the generic fallback below
 * title-cases any unmapped ALL-CAPS token, so a real reasoning string like "CTR turun 50%" rendered
 * as "Ctr turun 50%" — user-visible jank (observed live, 2026-09-21). These are presentation-safe to
 * pass through verbatim: they are industry-standard acronyms, not internal enum names (internal
 * enums belong in `labels` above and are translated there).
 */
const ACRONYMS = new Set([
  "CTR",
  "CPL",
  "CPQL",
  "CPC",
  "CPM",
  "CPA",
  "ROI",
  "ROAS",
  "KPI",
  "CRM",
  "QA",
  "DP",
  "WA",
  "API",
  "URL",
  "ID",
]);

export function presentLabel(value: string): string {
  const mapped = labels[value];
  if (mapped !== undefined) {
    return mapped;
  }
  if (ACRONYMS.has(value)) {
    return value;
  }
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function presentText(value: string): string {
  return value.replace(/\b[A-Z][A-Z_]{2,}\b/g, (token) => labels[token] ?? presentLabel(token));
}
